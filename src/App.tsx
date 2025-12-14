import React, { useState, useEffect } from 'react';
import { FileText, Upload, Download, Plus, ChevronRight, LogOut, X, Save, Clock } from 'lucide-react';
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
  const [generatedGrant, setGeneratedGrant] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [savedGrants, setSavedGrants] = useState<Array<{
    id: string;
    name: string;
    content: string;
    nonprofit_name: string;
    grantor_name: string;
    created_at: string;
  }>>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [savingGrant, setSavingGrant] = useState(false);

  // Load saved grants on component mount
  useEffect(() => {
    if (user) {
      loadSavedGrants();
    }
  }, [user]);

  // Load saved grants from database
  const loadSavedGrants = async () => {
    setLoadingGrants(true);
    try {
      const { data, error } = await supabase
        .from('saved_grants')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedGrants(data || []);
    } catch (error) {
      console.error('Error loading saved grants:', error);
    } finally {
      setLoadingGrants(false);
    }
  };

  // Save current grant to database
  const saveCurrentGrant = async () => {
    if (!generatedGrant || !user) {
      alert('No grant to save!');
      return;
    }

    setSavingGrant(true);
    try {
      const grantName = `${grantInfo.nonprofitName || 'Untitled'} - ${grantInfo.grantorName || 'Grant'}`;
      
      const { data, error } = await supabase
        .from('saved_grants')
        .insert([{
          user_id: user.id,
          name: grantName,
          content: generatedGrant,
          nonprofit_name: grantInfo.nonprofitName,
          grantor_name: grantInfo.grantorName,
          funding_amount: grantInfo.fundingAmount,
          additional_notes: grantInfo.additionalNotes
        }])
        .select();

      if (error) throw error;
      
      alert('Grant saved successfully!');
      await loadSavedGrants();
    } catch (error) {
      console.error('Error saving grant:', error);
      alert(`Failed to save grant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSavingGrant(false);
    }
  };

  // Load a saved grant
  const loadSavedGrant = (grant: typeof savedGrants[0]) => {
    setGeneratedGrant(grant.content);
    setGrantInfo({
      nonprofitName: grant.nonprofit_name || '',
      grantorName: grant.grantor_name || '',
      fundingAmount: grant.funding_amount || '',
      additionalNotes: grant.additional_notes || ''
    });
    setActiveSection('generate');
  };

  // Delete a saved grant
  const deleteSavedGrant = async (grantId: string) => {
    if (!confirm('Are you sure you want to delete this grant?')) return;

    try {
      const { error } = await supabase
        .from('saved_grants')
        .delete()
        .eq('id', grantId);

      if (error) throw error;
      
      await loadSavedGrants();
    } catch (error) {
      console.error('Error deleting grant:', error);
      alert(`Failed to delete grant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Function to render markdown to HTML with Helvetica font
  const renderMarkdownToHtml = (markdown: string): string => {
    let html = markdown
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers with inline styles
      .replace(/^### (.*$)/gim, '<h3 style="font-family: Helvetica, Arial, sans-serif; font-size: 18px; font-weight: bold; margin: 16px 0 6px 0;">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 style="font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: bold; margin: 18px 0 8px 0;">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 style="font-family: Helvetica, Arial, sans-serif; font-size: 28px; font-weight: bold; margin: 20px 0 10px 0;">$1</h1>')
      // Bold with inline style
      .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: bold;">$1</strong>')
      // Line breaks
      .replace(/\n/g, '<br>');
    
    return html;
  };

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

      console.log('Preparing to insert documents...');
      console.log('Form 990 URL:', uploadedFileUrls.form990);
      console.log('Form 1023 URL:', uploadedFileUrls.form1023);
      console.log('Past Projects URLs:', uploadedFileUrls.pastProjects);

      if (uploadedFileUrls.form990) {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.form990?.name || 'form990.pdf',
          file_type: '990',
          file_url: uploadedFileUrls.form990,
        });
        console.log('✓ Added Form 990 to insert queue');
      }

      if (uploadedFileUrls.form1023) {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.form1023?.name || 'form1023.pdf',
          file_type: '1023',
          file_url: uploadedFileUrls.form1023,
        });
        console.log('✓ Added Form 1023 to insert queue');
      }

      uploadedFileUrls.pastProjects.forEach((url, index) => {
        documentsToInsert.push({
          grant_id: grantId,
          file_name: files.pastProjects[index]?.name || `project_${index}.pdf`,
          file_type: 'past_project',
          file_url: url,
        });
        console.log(`✓ Added past project ${index + 1} to insert queue`);
      });

      if (documentsToInsert.length > 0) {
        const { error: docError } = await supabase
          .from('uploaded_documents')
          .insert(documentsToInsert);

        if (docError) {
          console.error('❌ Database insert error:', docError);
          throw docError;
        }
        console.log('Documents inserted successfully!');
      }

      console.log('Data saved to Supabase database successfully!');
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // Build the user request from grant info
      const userRequest = `Write a grant proposal for ${grantInfo.nonprofitName} to ${grantInfo.grantorName} requesting ${grantInfo.fundingAmount}. ${grantInfo.additionalNotes}`;
      
      const response = await fetch('http://localhost:3000/generate-grant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userRequest,
          nonprofitId: grantInfo.nonprofitName,
          matchCount: 5
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate grant');
      }

      const result = await response.json();
      
      // Display the final grant proposal
      console.log('Grant generated successfully!');
      console.log('Final Grant:', result.finalGrant);
      console.log('Context chunks used:', result.contextChunks?.length || 0);
      
      // Store the generated grant
      setGeneratedGrant(result.finalGrant);
      
    } catch (error) {
      console.error('Error generating grant:', error);
      alert(`Failed to generate grant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
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

                {showPdfPreview && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h3 className="text-xl font-bold text-gray-900">PDF Preview</h3>
                        <button 
                          onClick={() => setShowPdfPreview(false)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto p-8 bg-gray-50">
                        <div className="bg-white shadow-lg max-w-3xl mx-auto p-12" style={{ minHeight: '11in', width: '8.5in', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                          <div 
                            className="markdown-content text-base leading-relaxed text-gray-800"
                            style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(generatedGrant) }}
                          />
                        </div>
                      </div>
                      <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                        <button 
                          onClick={() => setShowPdfPreview(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Close
                        </button>
                        <button 
                          onClick={() => {
                            const printWindow = window.open('', '', 'height=600,width=800');
                            if (printWindow) {
                              printWindow.document.write('<html><head><title>Grant Proposal</title>');
                              printWindow.document.write('<style>');
                              printWindow.document.write('body { font-family: Helvetica, Arial, sans-serif; padding: 40px; line-height: 1.6; font-size: 16px; }');
                              printWindow.document.write('h1 { font-size: 28px; font-weight: bold; margin: 20px 0 10px 0; }');
                              printWindow.document.write('h2 { font-size: 22px; font-weight: bold; margin: 18px 0 8px 0; }');
                              printWindow.document.write('h3 { font-size: 18px; font-weight: bold; margin: 16px 0 6px 0; }');
                              printWindow.document.write('strong { font-weight: bold; }');
                              printWindow.document.write('@media print { body { margin: 0; padding: 40px; } }');
                              printWindow.document.write('</style>');
                              printWindow.document.write('</head><body>');
                              printWindow.document.write('<div>' + renderMarkdownToHtml(generatedGrant) + '</div>');
                              printWindow.document.write('</body></html>');
                              printWindow.document.close();
                              printWindow.print();
                            }
                            setShowPdfPreview(false);
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {generatedGrant && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Generated Proposal</h4>
                    <p className="text-sm text-gray-600 mb-3">Review and edit your grant proposal below:</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Feel free to further customize specific organizational details or statistics relevant to your mission and targeted communities. Thank you for considering our proposal.
                    </p>
                    <textarea
                      value={generatedGrant}
                      onChange={(e) => setGeneratedGrant(e.target.value)}
                      className="w-full h-96 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
                      placeholder="Your generated grant proposal will appear here..."
                    />

                    <div className="flex gap-3 mt-4">
                      <button 
                        onClick={() => setShowPdfPreview(true)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Preview as PDF
                      </button>
                      <button 
                        onClick={() => {
                          const blob = new Blob([generatedGrant], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${grantInfo.nonprofitName}_Grant_Proposal.docx`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export as DOCX
                      </button>
                      <button 
                        onClick={() => {
                          const printWindow = window.open('', '', 'height=600,width=800');
                          if (printWindow) {
                            printWindow.document.write('<html><head><title>Grant Proposal</title>');
                            printWindow.document.write('<style>body{font-family: Arial, sans-serif; padding: 40px; line-height: 1.6;}</style>');
                            printWindow.document.write('</head><body>');
                            printWindow.document.write('<pre style="white-space: pre-wrap; word-wrap: break-word;">' + generatedGrant + '</pre>');
                            printWindow.document.write('</body></html>');
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Export as PDF
                      </button>
                    </div>
                  </div>
                )}
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

      {/* Right Sidebar - Saved Grants */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Saved Grants</h2>
            {generatedGrant && (
              <button
                onClick={saveCurrentGrant}
                disabled={savingGrant}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                title="Save current grant"
              >
                {savingGrant ? (
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingGrants ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : savedGrants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No saved grants yet</p>
              <p className="text-xs mt-1">Generate and save your first grant!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedGrants.map((grant) => (
                <div
                  key={grant.id}
                  className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-200"
                  onClick={() => loadSavedGrant(grant)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
                      {grant.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSavedGrant(grant.id);
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete grant"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(grant.created_at).toLocaleDateString()}</span>
                  </div>
                  {grant.nonprofit_name && (
                    <p className="text-xs text-gray-600 mt-2 truncate">
                      {grant.nonprofit_name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}