import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, Eye, EyeOff, Star, Search, Filter, Briefcase, TrendingUp, Image, Code2 } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

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

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.technologies.some(tech => tech.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
      const matchesVisibility = 
        visibilityFilter === 'all' ||
        (visibilityFilter === 'visible' && project.visible) ||
        (visibilityFilter === 'hidden' && !project.visible);
      return matchesSearch && matchesCategory && matchesVisibility;
    });
  }, [projects, searchQuery, categoryFilter, visibilityFilter]);

  const stats = useMemo(() => {
    const total = projects.length;
    const visible = projects.filter(p => p.visible).length;
    const featured = projects.filter(p => p.featured).length;
    const categories = [...new Set(projects.map(p => p.category).filter(Boolean))].length;
    return { total, visible, featured, categories };
  }, [projects]);

  const categories = useMemo(() => {
    return [...new Set(projects.map(p => p.category).filter(Boolean))];
  }, [projects]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="glass-card p-8 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted font-medium">Loading portfolio...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border">
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <TrendingUp className="h-5 w-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-3xl font-bold bg-gradient-to-br from-primary to-primary-glow bg-clip-text text-transparent">{stats.total}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Projects</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Eye className="h-6 w-6 text-green-400" />
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/50">{stats.visible}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.visible}</p>
          <p className="text-sm text-muted-foreground mt-1">Visible</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Star className="h-6 w-6 text-yellow-400" />
            </div>
            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">{stats.featured}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.featured}</p>
          <p className="text-sm text-muted-foreground mt-1">Featured</p>
        </Card>

        <Card className="glass-card p-6 group hover:shadow-premium transition-all duration-500 animate-slide-up-fade border-2 border-glass-border" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Filter className="h-6 w-6 text-blue-400" />
            </div>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">{stats.categories}</Badge>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.categories}</p>
          <p className="text-sm text-muted-foreground mt-1">Categories</p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="glass-card p-6 animate-slide-up-fade" style={{ animationDelay: '0.4s' }}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by title, description, or technology..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass pl-10"
            />
          </div>
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="glass px-4 py-2 rounded-lg border border-glass-border bg-glass-bg text-foreground font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select 
            value={visibilityFilter} 
            onChange={(e) => setVisibilityFilter(e.target.value)}
            className="glass px-4 py-2 rounded-lg border border-glass-border bg-glass-bg text-foreground font-medium"
          >
            <option value="all">All Projects</option>
            <option value="visible">Visible Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
          <Button onClick={handleCreateNew} className="gap-2 hover:shadow-glow transition-all duration-300 whitespace-nowrap">
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        </div>
      </Card>

      {/* Projects Grid */}
      <div className="grid gap-4">
        {filteredProjects.map((project, index) => (
          <Card key={project.id} className="glass-card p-6">
            <div className="flex justify-between items-start gap-6">
              {/* Project Thumbnail */}
              {project.images && project.images.length > 0 && (
                <div className="relative w-48 h-32 rounded-xl overflow-hidden flex-shrink-0 border-2 border-glass-border group-hover:border-primary/30 transition-colors">
                  <img 
                    src={project.images[0]} 
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 text-xs text-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <Image className="h-3 w-3" />
                      {project.images.length}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent group-hover:from-primary group-hover:to-primary-glow transition-all duration-300 flex-1">{project.title}</h3>
                    <div className="flex gap-2 flex-shrink-0">
                      {project.featured && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50 font-semibold">
                          <Star className="h-3 w-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      {project.visible ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/50 font-semibold">
                          <Eye className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted font-semibold">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hidden
                        </Badge>
                      )}
                      {project.category && (
                        <Badge variant="outline" className="glass">
                          {project.category}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{project.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {project.technologies.slice(0, 6).map((tech, index) => (
                    <Badge key={index} variant="outline" className="glass font-medium">
                      <Code2 className="h-3 w-3 mr-1" />
                      {tech}
                    </Badge>
                  ))}
                  {project.technologies.length > 6 && (
                    <Badge variant="outline" className="glass-card border-primary/20">
                      +{project.technologies.length - 6} more
                    </Badge>
                  )}
                </div>

                {(project.live_url || project.github_url || project.client_name || project.project_year) && (
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {project.client_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Client: <span className="text-foreground font-medium">{project.client_name}</span>
                      </div>
                    )}
                    {project.project_year && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        Year: <span className="text-foreground font-medium">{project.project_year}</span>
                      </div>
                    )}
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-glow transition-colors font-medium"
                      >
                        View Live →
                      </a>
                    )}
                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary-glow transition-colors font-medium"
                      >
                        View Code →
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 ml-4 flex-shrink-0">
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
                      className="glass hover:shadow-glow hover:scale-105 transition-all duration-300"
                      onClick={() => {
                        setEditingProject(project);
                        setIsCreating(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass-card max-w-3xl max-h-[90vh] overflow-y-auto border-2 border-glass-border">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                        {isCreating ? '✨ Create Project' : '📝 Edit Project'}
                      </DialogTitle>
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
                          className="w-full hover:shadow-glow transition-all duration-300"
                        >
                          {isCreating ? '✨ Create Project' : '💾 Save Changes'}
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="outline"
                  className="glass hover:bg-destructive/20 hover:border-destructive/50 hover:scale-105 transition-all duration-300"
                  onClick={() => handleDeleteProject(project.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {filteredProjects.length === 0 && projects.length > 0 && (
          <Card className="glass-card p-12 text-center border-2 border-glass-border">
            <div className="max-w-md mx-auto">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Search className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Results Found</h3>
              <p className="text-muted-foreground">No projects match your current filters. Try adjusting your search criteria.</p>
            </div>
          </Card>
        )}

        {projects.length === 0 && (
          <Card className="glass-card p-12 text-center border-2 border-glass-border">
            <div className="max-w-md mx-auto">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-6">Create your first portfolio project to showcase your work!</p>
              <Button onClick={handleCreateNew} className="hover:shadow-glow transition-all duration-300">
                <Plus className="h-4 w-4 mr-2" />
                Add Project
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};