import React, { useState } from 'react';
import { FileText, Upload, Download, Plus, ChevronRight, LogOut, X } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import logo from './assets/altairium-logo.png';
import { supabase } from './lib/supabase';

export default function GrantWritingTool() {
  const { session, user, loading, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState('information');
  const [grantInfo, setGrantInfo] = useState({
    nonprofitName: '',
    grantorName: '',
    fundingAmount: '',
    additionalNotes: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState({
    form990: null as File | null,
    form1023: null as File | null,
    pastProjects: [] as File[]
  });
  const [uploadingFiles, setUploadingFiles] = useState({
    form990: false,
    form1023: false,
    pastProjects: false
  });
  const [uploadedFileUrls, setUploadedFileUrls] = useState<{
    form990: string | null;
    form1023: string | null;
    pastProjects: string[];
  }>({
    form990: null,
    form1023: null,
    pastProjects: []
  });
  const [grantApplicationId, setGrantApplicationId] = useState<string | null>(null);
  const [processingData, setProcessingData] = useState(false);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!session || !user) {
    return <LoginPage />;
  }

  // Handle file upload to Supabase Storage
  const handleFileUpload = async (fileType: 'form990' | 'form1023' | 'pastProjects', file: File) => {
    if (!user) return;

    setUploadingFiles({ ...uploadingFiles, [fileType]: true });

    try {
      // Create a unique file path: user-id/file-type/filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${fileType}/${fileName}`;

      // Upload file to Supabase Storage bucket
      const { data, error } = await supabase.storage
        .from('grant-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('grant-documents')
        .getPublicUrl(filePath);

      // Update state with the uploaded file and URL
      if (fileType === 'pastProjects') {
        setFiles({ ...files, pastProjects: [...files.pastProjects, file] });
        setUploadedFileUrls({ ...uploadedFileUrls, pastProjects: [...uploadedFileUrls.pastProjects, publicUrl] });
      } else {
        setFiles({ ...files, [fileType]: file });
        setUploadedFileUrls({ ...uploadedFileUrls, [fileType]: publicUrl });
      }

      console.log(`✅ ${file.name} uploaded successfully to Supabase!`);
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploadingFiles({ ...uploadingFiles, [fileType]: false });
    }
  };

  // Remove file from state and Supabase
  const handleRemoveFile = async (fileType: 'form990' | 'form1023', index?: number) => {
    if (!user) return;

    try {
      // Delete from Supabase Storage
      if (fileType === 'pastProjects' && index !== undefined) {
        const fileUrl = uploadedFileUrls.pastProjects[index];
        if (fileUrl) {
          const filePath = fileUrl.split('/grant-documents/')[1];
          await supabase.storage.from('grant-documents').remove([filePath]);
        }
        const newPastProjects = files.pastProjects.filter((_, i) => i !== index);
        const newPastProjectUrls = uploadedFileUrls.pastProjects.filter((_, i) => i !== index);
        setFiles({ ...files, pastProjects: newPastProjects });
        setUploadedFileUrls({ ...uploadedFileUrls, pastProjects: newPastProjectUrls });
      } else {
        const fileUrl = uploadedFileUrls[fileType];
        if (fileUrl) {
          const filePath = fileUrl.split('/grant-documents/')[1];
          await supabase.storage.from('grant-documents').remove([filePath]);
        }
        setFiles({ ...files, [fileType]: null });
        setUploadedFileUrls({ ...uploadedFileUrls, [fileType]: null });
      }
    } catch (error: any) {
      console.error('Error removing file:', error);
    }
  };

  // Process and save data to Supabase database when Next is clicked
  const handleProcessData = async () => {
    if (!user) return;

    setProcessingData(true);

    try {
      // 1. Create grant application record in database
      const { data: grantApp, error: grantError } = await supabase
        .from('grants')
        .insert({
          user_id: user.id,
          nonprofit_name: grantInfo.nonprofitName,
          grantor_name: grantInfo.grantorName,
          funding_amount: parseFloat(grantInfo.fundingAmount.replace(/[^0-9.]/g, '')) || null,
        })
        .select()
        .single();

      if (grantError) throw grantError;

      const grantId = grantApp.id;
      setGrantApplicationId(grantId);

      // 2. Save uploaded documents metadata to database
      const documentsToInsert = [];

      if (uploadedFileUrls.form990) {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.form990?.name || 'form990.pdf',
          file_type: '990',
          file_url: uploadedFileUrls.form990,
        });
      }

      if (uploadedFileUrls.form1023) {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.form1023?.name || 'form1023.pdf',
          file_type: '1023',
          file_url: uploadedFileUrls.form1023,
        });
      }

      uploadedFileUrls.pastProjects.forEach((url, index) => {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.pastProjects[index]?.name || `project_${index}.pdf`,
          file_type: 'past_project',
          file_url: url,
        });
      });

      if (documentsToInsert.length > 0) {
        const { error: docError } = await supabase
          .from('uploaded_documents')
          .insert(documentsToInsert);

        if (docError) throw docError;
      }

      console.log('✅ Data saved to Supabase database successfully!');
      console.log('Grant Application ID:', grantId);
      console.log('Uploaded Documents:', documentsToInsert);
      
      // TODO (Shrish): Call backend API to process documents and create embeddings

      alert('✅ Information saved! Ready to generate proposal.');
      setActiveSection('generate');
    } catch (error: any) {
      console.error('Error processing data:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setProcessingData(false);
    }
  };

  const sections = [
    { id: 'information', label: 'Grant Information', icon: FileText },
    { id: 'generate', label: 'Generate Draft', icon: Plus }
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    // TODO (Shrish): Replace with actual API call to generate grant proposal
    setTimeout(() => {
      setIsGenerating(false);
    }, 4000);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 bg-black flex flex-col py-4 rounded-r-2xl">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <img src={logo} alt="Altairium Logo" className="w-6 h-6" />
            </div>
            <span className="text-white font-semibold text-lg">Altairium</span>
          </div>
        </div>

        <div className="px-3 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">Tools</p>
        </div>
        
        <nav className="flex-1 flex flex-col gap-1 px-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg cursor-pointer">
            <FileText className="w-5 h-5 text-white" />
            <span className="text-white text-sm font-medium">Grant Writing</span>
          </div>
          
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
            <div className="w-5 h-5 bg-gray-700 rounded"></div>
            <span className="text-gray-500 text-sm font-medium">Coming Soon</span>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
            <div className="w-5 h-5 bg-gray-700 rounded"></div>
            <span className="text-gray-500 text-sm font-medium">Coming Soon</span>
          </div>
        </nav>

        <div className="px-3 mt-auto border-t border-gray-800 pt-4">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-900 cursor-pointer transition-colors">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-white text-sm font-medium block truncate">
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
              </span>
              <span className="text-gray-400 text-xs block truncate">
                {user.email}
              </span>
            </div>
            <button
              onClick={signOut}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-8 py-4">
          <h2 className="text-2xl font-bold text-gray-900">Grant Writing Tool</h2>
          <p className="text-sm text-gray-600 mt-1">Generate professional grant proposals with AI assistance</p>
        </header>

        {/* Progress Steps */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center gap-2">
            {sections.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <section.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
                {idx < sections.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          {activeSection === 'information' && (
            <div className="max-w-4xl">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Grant Information</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name of Nonprofit</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your nonprofit name"
                      value={grantInfo.nonprofitName}
                      onChange={(e) => setGrantInfo({...grantInfo, nonprofitName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Grantor Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Who are you applying to?"
                      value={grantInfo.grantorName}
                      onChange={(e) => setGrantInfo({...grantInfo, grantorName: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Funding Amount Requested</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="$0"
                      value={grantInfo.fundingAmount}
                      onChange={(e) => setGrantInfo({...grantInfo, fundingAmount: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Any additional information about your grant application"
                      value={grantInfo.additionalNotes}
                      onChange={(e) => setGrantInfo({...grantInfo, additionalNotes: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Proposal Structure</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                      <option value="standard">Standard Grant Proposal</option>
                      <option value="federal">Federal Grant Format</option>
                      <option value="foundation">Foundation Proposal</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Select the format that best matches your grant requirements</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Required Documents</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IRS Form 990</label>
                      {files.form990 ? (
                        <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">{files.form990.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile('form990')}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer block">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload('form990', file);
                            }}
                            disabled={uploadingFiles.form990}
                          />
                          {uploadingFiles.form990 ? (
                            <>
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Upload Form 990</p>
                              <p className="text-xs text-gray-500 mt-1">PDF up to 10MB</p>
                            </>
                          )}
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IRS Form 1023</label>
                      {files.form1023 ? (
                        <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <span className="text-sm text-gray-700">{files.form1023.name}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile('form1023')}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer block">
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload('form1023', file);
                            }}
                            disabled={uploadingFiles.form1023}
                          />
                          {uploadingFiles.form1023 ? (
                            <>
                              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Uploading...</p>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">Upload Form 1023</p>
                              <p className="text-xs text-gray-500 mt-1">PDF up to 10MB</p>
                            </>
                          )}
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Past Projects and Fundraisers</label>
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer block">
                        <input
                          type="file"
                          accept=".pdf,.docx"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const fileList = e.target.files;
                            if (fileList) {
                              Array.from(fileList).forEach(file => {
                                handleFileUpload('pastProjects', file);
                              });
                            }
                          }}
                          disabled={uploadingFiles.pastProjects}
                        />
                        {uploadingFiles.pastProjects ? (
                          <>
                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-sm text-gray-600">Uploading...</p>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600">Upload project documents</p>
                            <p className="text-xs text-gray-500 mt-1">PDF, DOCX up to 10MB each</p>
                          </>
                        )}
                      </label>
                      {files.pastProjects.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {files.pastProjects.map((file, index) => (
                            <div key={index} className="border border-gray-300 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-gray-700">{file.name}</span>
                              </div>
                              <button
                                onClick={() => {
                                  const newPastProjects = files.pastProjects.filter((_, i) => i !== index);
                                  setFiles({ ...files, pastProjects: newPastProjects });
                                }}
                                className="p-1 text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'generate' && (
            <div className="max-w-4xl">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Generate Draft Proposal</h3>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <h4 className="font-bold text-gray-900 mb-3">Ready to Generate</h4>
                  <div className="space-y-2 text-sm text-gray-700 mb-4">
                    <p>✓ Grant information collected</p>
                    <p>✓ Required documents uploaded</p>
                  </div>
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Generate Draft Proposal
                      </>
                    )}
                  </button>
                </div>

                {isGenerating && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
                      <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Your Proposal</h3>
                        <p className="text-gray-600">Please wait while we create your grant proposal draft...</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Preview: Draft Output</h4>
                  <div className="bg-gray-50 rounded-lg p-6 space-y-4 border border-gray-200">
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">Executive Summary</h5>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        [Generated content will appear here based on your inputs. The AI will create a cohesive narrative that aligns with grant writing best practices...]
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-800 mb-2">Needs Statement</h5>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        [This section will articulate the problem your project addresses, supported by relevant data and aligned with your organization's mission...]
                      </p>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-500">+ Additional sections</p>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      Export as DOCX
                    </button>
                    <button className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      Export as PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-8 py-4">
          <div className="flex justify-between items-center">
            <button 
              className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                if (activeSection === 'generate') setActiveSection('information');
              }}
              disabled={activeSection === 'information'}
            >
              ← Previous
            </button>
            <button 
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={handleProcessData}
              disabled={processingData || activeSection === 'generate'}
            >
              {processingData ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                'Next →'
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}