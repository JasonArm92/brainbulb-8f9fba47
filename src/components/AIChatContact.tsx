import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  projectType?: string;
  budget?: string;
  timeline?: string;
  description?: string;
}

const chatFlow = [
  {
    key: "name",
    question: "Hi! I'm here to help you get started with your web design project. What's your name?",
    followUp: "Nice to meet you, {name}! 👋"
  },
  {
    key: "email",
    question: "What's the best email address to reach you at?",
    validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    followUp: "Perfect! I'll make sure to send all updates to {email}."
  },
  {
    key: "company",
    question: "What's the name of your company or organization?",
    followUp: "Great! Tell me more about {company}."
  },
  {
    key: "projectType",
    question: "What type of website project are you looking for? (e.g., business website, e-commerce, portfolio, etc.)",
    followUp: "A {projectType} sounds exciting! 🚀"
  },
  {
    key: "budget",
    question: "What's your budget range for this project? This helps me recommend the best package for you.",
    followUp: "Thanks for sharing your budget information."
  },
  {
    key: "timeline",
    question: "When would you ideally like to launch your new website?",
    followUp: "Got it! We'll work towards your {timeline} timeline."
  },
  {
    key: "description",
    question: "Finally, please describe your vision for the website. What features do you need? What's your target audience?",
    followUp: "This is fantastic information! 🎯"
  }
];

export const AIChatContact = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi! I'm here to help you get started with your web design project. What's your name?",
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [chatData, setChatData] = useState<ChatData>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const addMessage = (text: string, sender: "user" | "ai") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;

    const userInput = currentInput.trim();
    addMessage(userInput, "user");
    setCurrentInput("");

    // Process the user's response
    const currentQuestion = chatFlow[currentStep];
    if (currentQuestion) {
      // Validate email if needed
      if (currentQuestion.validation && !currentQuestion.validation.test(userInput)) {
        setTimeout(() => {
          addMessage("Please enter a valid email address.", "ai");
        }, 500);
        return;
      }

      // Store the data
      const updatedData = { ...chatData, [currentQuestion.key]: userInput };
      setChatData(updatedData);

      // Send follow-up message
      setTimeout(() => {
        let followUpText = currentQuestion.followUp;
        // Replace placeholders
        Object.entries(updatedData).forEach(([key, value]) => {
          if (value) {
            followUpText = followUpText.replace(new RegExp(`{${key}}`, 'g'), value);
          }
        });
        addMessage(followUpText, "ai");

        // Move to next question or complete
        if (currentStep < chatFlow.length - 1) {
          setTimeout(() => {
            addMessage(chatFlow[currentStep + 1].question, "ai");
            setCurrentStep(currentStep + 1);
          }, 1000);
        } else {
          // Chat completed
          setTimeout(async () => {
            addMessage(
              "Thank you for all the information! 🎉 I've collected everything we need to get started. Someone from our team will review your requirements and get back to you within 24 hours with a detailed proposal. We're excited to work with you!",
              "ai"
            );
            setIsCompleted(true);
            
            // Save to database
            const { supabase } = await import('@/integrations/supabase/client');
            const { error } = await supabase.from('clients').insert({
              name: updatedData.name || '',
              email: updatedData.email || '',
              company: updatedData.company,
              phone: updatedData.phone,
              message: `Project Type: ${updatedData.projectType}\n\nDescription: ${updatedData.description}`,
              budget_range: updatedData.budget,
              project_timeline: updatedData.timeline,
              source: 'ai_chat',
            });

            if (error) {
              console.error('Error saving client:', error);
            } else {
              // Send onboarding email
              try {
                await supabase.functions.invoke('client-onboarding', {
                  body: {
                    clientName: updatedData.name,
                    clientEmail: updatedData.email,
                    company: updatedData.company,
                    budgetRange: updatedData.budget,
                    projectTimeline: updatedData.timeline,
                    message: updatedData.description,
                  },
                });
              } catch (emailError) {
                console.error('Error sending onboarding email:', emailError);
              }
            }
            
            toast({
              title: "Information Collected Successfully!",
              description: "We'll be in touch within 24 hours with your custom proposal.",
            });
          }, 1500);
        }
      }, 800);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="glass-card rounded-2xl shadow-premium animate-glass-appear h-[600px] flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-glass-border">
        <div className="bg-primary/10 p-2 rounded-full">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">AI Project Assistant</h3>
          <p className="text-sm text-muted-foreground">Let's discuss your project requirements</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {message.sender === "ai" && (
              <div className="bg-primary/10 p-2 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] p-3 rounded-2xl ${
                message.sender === "user"
                  ? "bg-primary text-primary-foreground ml-auto"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {message.sender === "user" && (
              <div className="bg-primary/10 p-2 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isCompleted && (
        <div className="p-4 border-t border-glass-border">
          <div className="flex gap-2">
            <Input
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your response..."
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              variant="cta"
              size="sm"
              disabled={!currentInput.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};