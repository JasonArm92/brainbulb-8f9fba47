import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const projectDetailsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  company: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  projectIdea: z.string().trim().min(10, "Please provide at least 10 characters").max(2000),
  goals: z.string().trim().min(10, "Please provide at least 10 characters").max(2000),
  timeline: z.string().trim().max(100).optional(),
  budget: z.string().trim().max(100).optional(),
});

interface PricingPlan {
  name: string;
  price: number | string;
  description: string;
}

export const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const plan = location.state?.plan as PricingPlan | undefined;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    projectIdea: "",
    goals: "",
    timeline: "",
    budget: "",
  });

  useEffect(() => {
    if (!plan) {
      navigate("/pricing");
    }
  }, [plan, navigate]);

  if (!plan) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form data
      const validatedData = projectDetailsSchema.parse(formData);

      // Store project inquiry in database
      const { error } = await supabase.from("clients").insert({
        name: validatedData.name,
        email: validatedData.email,
        company: validatedData.company || null,
        phone: validatedData.phone || null,
        message: `Project Idea: ${validatedData.projectIdea}\n\nGoals: ${validatedData.goals}`,
        project_timeline: validatedData.timeline || null,
        budget_range: validatedData.budget || `${plan.name} - £${plan.price}`,
        source: "pricing_checkout",
        status: "new",
        priority: plan.name === "Professional" ? "high" : "medium",
      });

      if (error) throw error;

      toast({
        title: "Request Submitted!",
        description: "We'll get back to you within 24 hours to discuss your project.",
      });

      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to submit your request. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/pricing")}
          className="mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Pricing
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Plan Summary */}
          <div>
            <Card className="p-8 bg-background/95 backdrop-blur-xl border-primary/20 sticky top-24">
              <div className="mb-6">
                {plan.name === "Professional" && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-primary text-primary-foreground text-xs font-bold mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    Most Popular
                  </div>
                )}
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {plan.name}
                </h2>
                <p className="text-muted-foreground">{plan.description}</p>
              </div>

              <div className="py-6 border-y border-border/50 mb-6">
                {plan.price === "enquiry" ? (
                  <div className="text-2xl font-bold">Custom Pricing</div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm text-muted-foreground">from</span>
                    <span className="text-4xl font-bold tracking-tight">£{plan.price}</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span>Secure payment processing</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="w-5 h-5 text-primary" />
                  <span>Detailed project proposal</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Project Details Form */}
          <div>
            <Card className="p-8 bg-background/95 backdrop-blur-xl border-primary/20">
              <h2 className="text-2xl font-bold mb-6">Project Details</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      maxLength={100}
                      placeholder="John Doe"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      maxLength={255}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      maxLength={100}
                      placeholder="Company Name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      maxLength={20}
                      placeholder="+44 123 456 7890"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectIdea">Project Idea *</Label>
                  <Textarea
                    id="projectIdea"
                    name="projectIdea"
                    value={formData.projectIdea}
                    onChange={handleInputChange}
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="Describe your project idea in detail..."
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.projectIdea.length}/2000 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goals">What Are You Looking to Achieve? *</Label>
                  <Textarea
                    id="goals"
                    name="goals"
                    value={formData.goals}
                    onChange={handleInputChange}
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder="What are your main goals and objectives for this project?"
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.goals.length}/2000 characters
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeline">Preferred Timeline</Label>
                    <Input
                      id="timeline"
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleInputChange}
                      maxLength={100}
                      placeholder="e.g., 2-3 months"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget Range</Label>
                    <Input
                      id="budget"
                      name="budget"
                      value={formData.budget}
                      onChange={handleInputChange}
                      maxLength={100}
                      placeholder="e.g., £5,000 - £10,000"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-primary hover:shadow-glow border-0"
                >
                  {isSubmitting ? "Submitting..." : "Submit Project Request"}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By submitting, you agree to be contacted about your project.
                </p>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
