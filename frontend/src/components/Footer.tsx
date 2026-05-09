import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/5 text-white/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-white/70 font-medium text-sm mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/" className="hover:text-white/80 transition-colors">Home</Link></li>
              <li><Link to="/login" className="hover:text-white/80 transition-colors">Get Started</Link></li>
              <li><Link to="/docs" className="hover:text-white/80 transition-colors">Documentation</Link></li>
              <li><Link to="/docs/api" className="hover:text-white/80 transition-colors">API Reference</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white/70 font-medium text-sm mb-4">Features</h4>
            <ul className="space-y-2.5 text-sm">
              <li><span>Auto-Indexing</span></li>
              <li><span>RAG Agents</span></li>
              <li><span>API Access</span></li>
              <li><span>Multi-Tenant</span></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white/70 font-medium text-sm mb-4">Resources</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/docs" className="hover:text-white/80 transition-colors">Guides</Link></li>
              <li><Link to="/docs/api" className="hover:text-white/80 transition-colors">API Docs</Link></li>
              <li><a href="https://github.com/rust4ai" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">GitHub</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white/70 font-medium text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/privacy" className="hover:text-white/80 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-white/80 transition-colors">Terms of Service</Link></li>
              <li><a href="mailto:support@solarabase.com" className="hover:text-white/80 transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/25">&copy; {new Date().getFullYear()} Solarabase. All rights reserved.</p>
          <p className="text-xs text-white/25">Knowledgebase-as-a-Service</p>
        </div>
      </div>
    </footer>
  );
}
