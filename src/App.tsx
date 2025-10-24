import React, { useState } from 'react';
import { FileText, Upload, Download, Plus, ChevronRight } from 'lucide-react';

export default function GrantWritingTool() {
  const [activeSection, setActiveSection] = useState('information');
  const [grantInfo, setGrantInfo] = useState({
    nonprofitName: '',
    grantorName: '',
    fundingAmount: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  
  // TODO: Add state for file uploads
  // const [files, setFiles] = useState({
  //   form990: null,
  //   form1023: null,
  //   pastProjects: []
  // });
  
  // TODO: Add state for generated proposal
  // const [generatedProposal, setGeneratedProposal] = useState(null);
  
  // TODO: Add state for saved drafts
  // const [savedDrafts, setSavedDrafts] = useState([]);

  // TODO: GET - Load saved drafts when component mounts
  // useEffect(() => {
  //   const loadSavedDrafts = async () => {
  //     try {
  //       const response = await fetch('/api/drafts');
  //       const data = await response.json();
  //       setSavedDrafts(data.drafts);
  //     } catch (error) {
  //       console.error('Failed to load drafts:', error);
  //     }
  //   };
  //   loadSavedDrafts();
  // }, []);

  const sections = [
    { id: 'information', label: 'Grant Information', icon: FileText },
    { id: 'generate', label: 'Generate Draft', icon: Plus }
  ];

  // TODO: POST - Handle file uploads
  // const handleFileUpload = async (fileType, file) => {
  //   const formData = new FormData();
  //   formData.append('file', file);
  //   formData.append('fileType', fileType);
  //   
  //   try {
  //     const response = await fetch('/api/upload', {
  //       method: 'POST',
  //       body: formData
  //     });
  //     const data = await response.json();
  //     setFiles({...files, [fileType]: data.fileUrl});
  //   } catch (error) {
  //     console.error('Upload failed:', error);
  //   }
  // };

  // TODO: POST - Generate grant proposal with all form data
  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 4000);
    
    // Replace setTimeout with actual API call:
    // const handleGenerate = async () => {
    //   setIsGenerating(true);
    //   
    //   try {
    //     const response = await fetch('/api/generate-grant', {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //       },
    //       body: JSON.stringify({
    //         nonprofitName: grantInfo.nonprofitName,
    //         grantorName: grantInfo.grantorName,
    //         fundingAmount: grantInfo.fundingAmount,
    //         files: files
    //       })
    //     });
    //     
    //     const data = await response.json();
    //     setGeneratedProposal(data.proposal);
    //   } catch (error) {
    //     console.error('Generation failed:', error);
    //   } finally {
    //     setIsGenerating(false);
    //   }
    // };
  };

  // TODO: POST - Export proposal as DOCX or PDF
  // const handleExport = async (format) => {
  //   try {
  //     const response = await fetch('/api/export', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         proposal: generatedProposal,
  //         format: format // 'docx' or 'pdf'
  //       })
  //     });
  //     
  //     const blob = await response.blob();
  //     const url = window.URL.createObjectURL(blob);
  //     const a = document.createElement('a');
  //     a.href = url;
  //     a.download = `grant-proposal.${format}`;
  //     a.click();
  //   } catch (error) {
  //     console.error('Export failed:', error);
  //   }
  // };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 bg-black flex flex-col py-4 rounded-r-2xl">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <span className="text-black font-bold text-xl">A</span>
            </div>
            <span className="text-white font-semibold text-lg">GrantAI</span>
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
              JD
            </div>
            <span className="text-white text-sm font-medium">John Doe</span>
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
                      {/* TODO: Wire up handleFileUpload('form990', file) on file selection */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Upload Form 990</p>
                        <p className="text-xs text-gray-500 mt-1">PDF up to 10MB</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">IRS Form 1023</label>
                      {/* TODO: Wire up handleFileUpload('form1023', file) on file selection */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Upload Form 1023</p>
                        <p className="text-xs text-gray-500 mt-1">PDF up to 10MB</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Past Projects and Fundraisers</label>
                      {/* TODO: Wire up handleFileUpload('pastProjects', file) on file selection - allow multiple */}
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Upload project documents</p>
                        <p className="text-xs text-gray-500 mt-1">PDF, DOCX up to 10MB each</p>
                      </div>
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
                    {/* TODO: Wire up handleExport('docx') onClick */}
                    <button className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      Export as DOCX
                    </button>
                    {/* TODO: Wire up handleExport('pdf') onClick */}
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
            <button className="px-4 py-2 text-gray-600 hover:text-gray-900">
              ← Previous
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Next →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
