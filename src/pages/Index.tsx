
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Star, MessageSquare, Database, Zap, Users, ChevronRight, ArrowRight } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import ChatWidget from '@/components/chat/ChatWidget';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-500 text-white">
        <div className="container mx-auto px-6 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">Add AI Chat to Your Website</h1>
          <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto">
            Powerful AI chat widget that can learn from your data and provide instant support to your customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/register')} className="bg-white text-purple-600 hover:bg-gray-100">
              Get Started Free
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="text-white border-white hover:bg-white/10">
              Log In
            </Button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-20 container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4">Powerful Features</h2>
        <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Everything you need to create an intelligent chat experience for your website visitors
        </p>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Multiple Data Sources</h3>
            <p className="text-gray-600">Connect your knowledge base, PDFs, websites, and more to train your AI assistant.</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Deployment</h3>
            <p className="text-gray-600">Add the widget to your website with a simple embed code. No coding required.</p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Human Escalation</h3>
            <p className="text-gray-600">Seamlessly hand off conversations to human agents when needed.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Choose the plan that works for your business needs
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 hover:border-purple-200 transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-xl">Starter</CardTitle>
                <div className="text-3xl font-bold">$0</div>
                <CardDescription>Free forever</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {['1,000 messages/month', 'Basic data integration', 'Standard support'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => navigate('/register')}>
                  Get Started
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-purple-400 shadow-lg relative">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 bg-purple-600 text-white text-xs py-1 px-3 rounded-full">
                Popular
              </div>
              <CardHeader>
                <CardTitle className="text-xl">Pro</CardTitle>
                <div className="text-3xl font-bold">$49</div>
                <CardDescription>per month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {['10,000 messages/month', 'Multiple data sources', 'Priority support', 'Custom branding'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => navigate('/register')}>
                  Choose Pro
                </Button>
              </CardFooter>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 hover:border-purple-200 transition-all duration-200">
              <CardHeader>
                <CardTitle className="text-xl">Enterprise</CardTitle>
                <div className="text-3xl font-bold">Contact Us</div>
                <CardDescription>Custom pricing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {['Unlimited messages', 'Custom integrations', 'Dedicated support', 'SLA guarantees', 'Custom features'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => navigate('/register')}>
                  Contact Sales
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 container mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-4">What Our Customers Say</h2>
        <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Trusted by businesses of all sizes
        </p>

        <Carousel className="max-w-4xl mx-auto">
          <CarouselContent>
            {testimonials.map((testimonial, index) => (
              <CarouselItem key={index}>
                <div className="p-6 bg-white rounded-lg shadow-md">
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 italic mb-6">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-bold">{testimonial.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{testimonial.name}</h4>
                      <p className="text-gray-600 text-sm">{testimonial.title}</p>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="flex justify-center mt-6 gap-2">
            <CarouselPrevious className="relative static transform-none translate-y-0 translate-x-0 left-0" />
            <CarouselNext className="relative static transform-none translate-y-0 translate-x-0 right-0" />
          </div>
        </Carousel>
      </section>

      {/* Demo Section */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Try It Now</h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto">Experience our AI chat widget live on this page. Click the chat icon in the bottom right corner.</p>
          <Button 
            size="lg" 
            className="group"
            onClick={() => {
              const chatButton = document.querySelector(".chat-widget-bubble");
              if (chatButton) {
                (chatButton as HTMLElement).click();
              }
            }}
          >
            Open Chat Widget <ChevronRight className="ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your customer support?</h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto">Join thousands of businesses using our AI chat solution.</p>
          <Button 
            size="lg" 
            className="bg-white text-purple-600 hover:bg-gray-100"
            onClick={() => navigate('/register')}
          >
            Get Started Free <ArrowRight className="ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="text-white text-lg font-bold mb-4">AI Chat Widget</h3>
              <p className="mb-4">Powered by advanced AI to help your customers get answers instantly.</p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                {['Features', 'Pricing', 'Integrations', 'FAQ'].map(item => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                {['About Us', 'Blog', 'Careers', 'Contact'].map(item => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'GDPR'].map(item => (
                  <li key={item}><a href="#" className="hover:text-white transition-colors">{item}</a></li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 mt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} AI Chat Widget. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Embed the Chat Widget as a demo */}
      <ChatWidget 
        botName="Demo AI Assistant"
        welcomeMessage="Hi there! 👋 This is a demo of our AI chat widget. Feel free to ask questions about our service!"
      />
    </div>
  );
};

// Testimonial data
const testimonials = [
  {
    name: "Sarah Johnson",
    title: "Marketing Director, TechCorp",
    quote: "This AI chat solution has transformed our customer support. Response times are down 80% and customer satisfaction has never been higher."
  },
  {
    name: "David Chen",
    title: "CEO, StartupX",
    quote: "I was skeptical at first, but the AI has been trained so well on our documentation that it handles 90% of inquiries without human intervention."
  },
  {
    name: "Michelle Parker",
    title: "Support Lead, E-commerce Plus",
    quote: "The seamless human handoff feature is a game-changer. Our team now focuses on complex issues while the AI handles routine questions."
  }
];

export default Index;
