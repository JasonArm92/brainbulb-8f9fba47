import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Eye, EyeOff, Star } from 'lucide-react';

interface Project {
  id: string;
  title: string;
  description: string;
  full_description?: string;
  technologies: string[];
  images: string[];
  live_url?: string;
  github_url?: string;
  category?: string;
  featured: boolean;
  visible: boolean;
  client_name?: string;
  project_year?: number;
  duration?: string;
}

export const PortfolioManager = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('portfolio_projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch projects');
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const handleSaveProject = async (project: Project) => {
    if (isCreating) {
      const { error } = await supabase
        .from('portfolio_projects')
        .insert({
          title: project.title,
          description: project.description,
          full_description: project.full_description,
          technologies: project.technologies,
          images: project.images,
          live_url: project.live_url,
          github_url: project.github_url,
          category: project.category,
          featured: project.featured,
          visible: project.visible,
          client_name: project.client_name,
          project_year: project.project_year,
          duration: project.duration,
        });

      if (error) {
        toast.error('Failed to create project');
      } else {
        toast.success('Project created successfully');
        fetchProjects();
        setIsDialogOpen(false);
        setEditingProject(null);
        setIsCreating(false);
      }
    } else {
      const { error } = await supabase
        .from('portfolio_projects')
        .update(project)
        .eq('id', project.id);

      if (error) {
        toast.error('Failed to update project');
      } else {
        toast.success('Project updated successfully');
        fetchProjects();
        setIsDialogOpen(false);
        setEditingProject(null);
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    const { error } = await supabase
      .from('portfolio_projects')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete project');
    } else {
      toast.success('Project deleted successfully');
      fetchProjects();
    }
  };

  const handleCreateNew = () => {
    setEditingProject({
      id: '',
      title: '',
      description: '',
      technologies: [],
      images: [],
      featured: false,
      visible: true,
    });
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-12">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Portfolio Management</h2>
          <p className="text-muted">Total projects: {projects.length}</p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="glass-card p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-semibold text-foreground">{project.title}</h3>
                      {project.featured && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {!project.visible && (
                        <Badge variant="outline" className="border-muted">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted">{project.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.technologies.map((tech, index) => (
                    <Badge key={index} variant="outline" className="glass">
                      {tech}
                    </Badge>
                  ))}
                </div>

                {(project.live_url || project.github_url) && (
                  <div className="flex gap-3 text-sm">
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-glow transition-colors"
                      >
                        View Live →
                      </a>
                    )}
                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-glow transition-colors"
                      >
                        View Code →
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4">
                <Dialog
                  open={isDialogOpen && editingProject?.id === project.id}
                  onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                      setEditingProject(null);
                      setIsCreating(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="glass"
                      onClick={() => {
                        setEditingProject(project);
                        setIsCreating(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{isCreating ? 'Create Project' : 'Edit Project'}</DialogTitle>
                    </DialogHeader>
                    {editingProject && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Title</label>
                          <Input
                            value={editingProject.title}
                            onChange={(e) =>
                              setEditingProject({ ...editingProject, title: e.target.value })
                            }
                            className="glass"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Description</label>
                          <Textarea
                            value={editingProject.description}
                            onChange={(e) =>
                              setEditingProject({ ...editingProject, description: e.target.value })
                            }
                            className="glass min-h-[80px]"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Technologies (comma-separated)</label>
                          <Input
                            value={editingProject.technologies.join(', ')}
                            onChange={(e) =>
                              setEditingProject({
                                ...editingProject,
                                technologies: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                              })
                            }
                            className="glass"
                            placeholder="React, TypeScript, Node.js"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Image URLs (comma-separated)</label>
                          <Textarea
                            value={editingProject.images.join(', ')}
                            onChange={(e) =>
                              setEditingProject({
                                ...editingProject,
                                images: e.target.value.split(',').map(url => url.trim()).filter(Boolean),
                              })
                            }
                            className="glass min-h-[80px]"
                            placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Live URL</label>
                            <Input
                              value={editingProject.live_url || ''}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, live_url: e.target.value })
                              }
                              className="glass"
                              placeholder="https://example.com"
                            />
                          </div>

                          <div>
                            <label className="text-sm font-medium mb-2 block">GitHub URL</label>
                            <Input
                              value={editingProject.github_url || ''}
                              onChange={(e) =>
                                setEditingProject({ ...editingProject, github_url: e.target.value })
                              }
                              className="glass"
                              placeholder="https://github.com/..."
                            />
                          </div>
                        </div>

                        <div className="flex gap-6">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editingProject.visible}
                              onCheckedChange={(checked) =>
                                setEditingProject({ ...editingProject, visible: checked })
                              }
                            />
                            <label className="text-sm font-medium">Visible on site</label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={editingProject.featured}
                              onCheckedChange={(checked) =>
                                setEditingProject({ ...editingProject, featured: checked })
                              }
                            />
                            <label className="text-sm font-medium">Featured</label>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleSaveProject(editingProject)}
                          className="w-full"
                        >
                          {isCreating ? 'Create Project' : 'Save Changes'}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  className="glass hover:bg-destructive/20"
                  onClick={() => handleDeleteProject(project.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {projects.length === 0 && (
          <Card className="glass-card p-12 text-center">
            <p className="text-muted text-lg mb-4">No projects yet. Create your first portfolio project!</p>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};