import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  Upload, Download, FileText, Image, File, Trash2, 
  FolderOpen, Clock, FileArchive, FileSpreadsheet,
  Loader2, Eye, X
} from 'lucide-react';
import { format } from 'date-fns';

interface ProjectFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  description: string | null;
  uploaded_by: string;
  created_at: string;
}

interface FileSharingProps {
  clientId: string;
}

export function FileSharing({ clientId }: FileSharingProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string; name: string } | null>(null);
  const [clientData, setClientData] = useState<{ name: string; email: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchFiles();
    fetchClientData();
  }, [clientId]);

  const fetchClientData = async () => {
    const { data } = await supabase
      .from('clients')
      .select('name, email')
      .eq('id', clientId)
      .single();
    
    if (data) {
      setClientData(data);
    }
  };

  const fetchFiles = async () => {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFiles(data);
    }
    setLoading(false);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />;
    if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType.includes('spreadsheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (fileType.includes('zip') || fileType.includes('archive')) return <FileArchive className="h-5 w-5 text-yellow-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canPreview = (fileType: string) => {
    return fileType.startsWith('image/') || fileType.includes('pdf');
  };

  const handlePreview = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.file_path, 60 * 5);

      if (error) throw error;

      setPreviewFile({
        url: data.signedUrl,
        type: file.file_type,
        name: file.file_name,
      });
    } catch (error: any) {
      toast({
        title: 'Preview failed',
        description: error.message || 'Failed to load file preview',
        variant: 'destructive',
      });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    if (file.size > MAX_SIZE) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      const filePath = `${clientId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          client_id: clientId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          description: description || null,
          uploaded_by: 'client',
        });

      if (dbError) throw dbError;

      // Send email notification
      if (clientData) {
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'file_uploaded',
              clientName: clientData.name,
              clientEmail: clientData.email,
              fileName: file.name,
              fileSize: formatFileSize(file.size),
              uploadedBy: 'client',
            },
          });
        } catch (notifError) {
          console.error('Failed to send notification:', notifError);
        }
      }

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully`,
      });

      setDescription('');
      fetchFiles();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    if (file.uploaded_by !== 'client') {
      toast({
        title: 'Cannot delete',
        description: 'You can only delete files you uploaded',
        variant: 'destructive',
      });
      return;
    }

    setDeleting(file.id);

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('project-files')
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('project_files')
        .delete()
        .eq('id', file.id);

      if (dbError) throw dbError;

      toast({
        title: 'File deleted',
        description: `${file.file_name} has been deleted`,
      });

      fetchFiles();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Delete failed',
        description: error.message || 'Failed to delete file',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.file_path, 60 * 5);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: error.message || 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{previewFile?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto max-h-[70vh]">
            {previewFile?.type.startsWith('image/') && (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="w-full h-auto object-contain rounded-lg"
              />
            )}
            {previewFile?.type.includes('pdf') && (
              <iframe
                src={previewFile.url}
                title={previewFile.name}
                className="w-full h-[65vh] rounded-lg border"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Upload Files</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for your file (optional)"
              className="mb-3"
              rows={2}
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose File to Upload
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Max 10MB • Images, PDFs, Documents, Spreadsheets, Archives
          </p>
        </div>
      </Card>

      {/* Files List */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Project Files ({files.length})
        </h3>

        {files.length === 0 ? (
          <Card className="p-8 text-center">
            <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No files shared yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload files above or check back when your designer shares files.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <Card key={file.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-muted rounded-lg">
                    {getFileIcon(file.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{file.file_name}</h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {file.uploaded_by === 'admin' ? 'Designer' : 'You'}
                      </Badge>
                    </div>
                    {file.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {file.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <File className="h-3 w-3" />
                        {formatFileSize(file.file_size)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(file.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canPreview(file.file_type) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePreview(file)}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(file)}
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {file.uploaded_by === 'client' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deleting === file.id}
                            title="Delete"
                          >
                            {deleting === file.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete file?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{file.file_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(file)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}