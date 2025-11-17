# Supabase Storage Setup Guide

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"Create a new bucket"**
4. Configure:
   - **Name**: `grant-documents`
   - **Public bucket**: ✅ **Turn ON** (we need public URLs to access files)
   - Click **"Create bucket"**

## Step 2: Set Up Storage Policies

Click on the `grant-documents` bucket and go to the **"Policies"** tab.

### Policy 1: Allow Upload (INSERT)
Users can upload files to their own folder:

```sql
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'grant-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 2: Allow Read (SELECT)
Users can view their own files:

```sql
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'grant-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 3: Allow Delete
Users can delete their own files:

```sql
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'grant-documents' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Policy 4: Public Read Access (Optional)
If you want files to be publicly accessible via URL:

```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'grant-documents');
```

## File Structure in Supabase Storage

Files will be organized like this:

```
grant-documents/
├── user-id-1/
│   ├── form990/
│   │   └── 1234567890_abc123.pdf
│   ├── form1023/
│   │   └── 1234567891_def456.pdf
│   └── pastProjects/
│       ├── 1234567892_ghi789.pdf
│       └── 1234567893_jkl012.docx
└── user-id-2/
    └── ...
```

## Database Tables Already Set Up

Your `schema.sql` already includes:

- ✅ `grant_applications` - Stores grant information
- ✅ `uploaded_documents` - Stores document metadata and URLs

## How It Works

### When User Uploads Files:
1. Files are uploaded to Supabase Storage bucket `grant-documents`
2. Files are organized by user ID and document type
3. Public URLs are generated for each file
4. File metadata is saved locally in state

### When User Clicks "Next":
1. **Grant Application** record is created in database with:
   - Organization name
   - Grantor name
   - Funding amount
   - Additional notes
   
2. **Document Records** are created for each uploaded file with:
   - Grant ID (links to grant application)
   - File name
   - File type (990, 1023, or past_project)
   - File URL (Supabase Storage URL)

3. Console logs show:
   - ✅ Success messages
   - Grant Application ID
   - Document details

### Next Steps (For Shrish):
4. Backend API can be called to:
   - Fetch files from Supabase Storage URLs
   - Extract text from PDFs/DOCX
   - Create embeddings
   - Store embeddings in `document_embeddings` table

## Testing

1. Sign up/login to the app
2. Fill in grant information
3. Upload test documents (PDF files)
4. Click "Next" button
5. Check browser console for success messages
6. Verify in Supabase Dashboard:
   - **Storage**: Files should appear in `grant-documents` bucket
   - **Table Editor**: Check `grant_applications` and `uploaded_documents` tables

## Environment Variables

Make sure your `.env` file has:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```