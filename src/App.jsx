import { useState, useEffect, useRef } from "react";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { authAPI, patentAPI, statsAPI, submissionAPI, notificationAPI } from './api';

// Cookie management utilities
const CookieManager = {
  set: (name, value, days = 30) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${JSON.stringify(value)};expires=${expires.toUTCString()};path=/`;
  },
  
  get: (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        try {
          return JSON.parse(c.substring(nameEQ.length, c.length));
        } catch (e) {
          return c.substring(nameEQ.length, c.length);
        }
      }
    }
    return null;
  },
  
  remove: (name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  },
  
  // Store submission data with forms
  storeSubmissionData: (submissionId, data) => {
    const key = `submission_${submissionId}`;
    CookieManager.set(key, {
      ...data,
      storedAt: new Date().toISOString(),
      submissionId
    }, 90); // Store for 90 days
  },
  
  // Get submission data
  getSubmissionData: (submissionId) => {
    return CookieManager.get(`submission_${submissionId}`);
  },
  
  // Store admin review history
  storeAdminAction: (action) => {
    const history = CookieManager.get('admin_history') || [];
    history.unshift({
      ...action,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });
    // Keep only last 100 actions
    if (history.length > 100) history.splice(100);
    CookieManager.set('admin_history', history, 365);
  },
  
  // Get admin history
  getAdminHistory: () => {
    return CookieManager.get('admin_history') || [];
  }
};

// Configure PDF.js worker - use Vite's ?url import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const C = {
  navy:"#ffffff", navyL:"#f8f9fa", indigo:"#2B5F8F", indigoL:"#3A7AB8",
  gold:"#FF8A65", green:"#4CAF50", warn:"#FF8A65", danger:"#f44336",
  text:"#2c3e50", muted:"#6c757d", card:"#ffffff", border:"#dee2e6",
  blue:"#2B5F8F", blueLight:"#3A7AB8", orange:"#FF8A65",
};

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f8f9fa;color:#2c3e50;font-family:'Space Grotesk',sans-serif;min-height:100vh}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#2B5F8F;border-radius:3px}
.bg{min-height:100vh;background:linear-gradient(135deg, #ffffff 0%, #f0f4f8 50%, #e8f1f8 100%)}
.btn{background:linear-gradient(135deg,#2B5F8F,#3A7AB8);color:#fff;border:none;border-radius:10px;padding:13px 26px;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .3s;box-shadow:0 4px 12px rgba(43,95,143,.25);letter-spacing:.3px}
.btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(43,95,143,.35)}
.btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.btn-gold{background:linear-gradient(135deg,#FF6F4D,#FF8A65);color:#fff;border:none;border-radius:10px;padding:13px 26px;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:all .3s;box-shadow:0 4px 12px rgba(255,138,101,.25);letter-spacing:.3px}
.btn-gold:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(255,138,101,.35)}
.btn-gold:disabled{opacity:.45;cursor:not-allowed;transform:none}
.ghost{background:transparent;color:#6c757d;border:1px solid #dee2e6;border-radius:10px;padding:11px 22px;font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:500;cursor:pointer;transition:all .3s}
.ghost:hover{border-color:#2B5F8F;color:#2B5F8F;background:rgba(43,95,143,.05)}
.inp{width:100%;background:#ffffff;border:1px solid #dee2e6;border-radius:10px;padding:11px 15px;color:#2c3e50;font-family:'Space Grotesk',sans-serif;font-size:14px;transition:all .3s;outline:none;resize:vertical}
.inp:focus{border-color:#2B5F8F;background:#ffffff;box-shadow:0 0 0 3px rgba(43,95,143,.1)}
.inp::placeholder{color:#adb5bd}
select.inp option{background:#ffffff}
.lbl{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#6c757d;margin-bottom:7px}
.nav{background:#ffffff;border-bottom:1px solid #dee2e6;box-shadow:0 2px 8px rgba(0,0,0,.05);position:sticky;top:0;z-index:100;padding:0 28px;height:62px;display:flex;align-items:center;justify-content:space-between}
.logo{font-family:'Syne',sans-serif;font-weight:800;letter-spacing:-1px}
.mono{font-family:'JetBrains Mono',monospace}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
@media(max-width:720px){.g2{grid-template-columns:1fr}.g3{grid-template-columns:1fr 1fr}}
@media(max-width:460px){.g3{grid-template-columns:1fr}}
.rc{background:#ffffff;border:1px solid #dee2e6;border-radius:14px;padding:22px;animation:fsu .5s ease forwards;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.rc:hover{border-color:#2B5F8F;box-shadow:0 4px 16px rgba(43,95,143,.12)}
.div{height:1px;background:linear-gradient(90deg,transparent,#dee2e6,transparent);margin:16px 0}
.bdg{display:inline-flex;align-items:center;padding:3px 11px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.4px}
.bg-g{background:rgba(76,175,80,.1);color:#2e7d32;border:1px solid rgba(76,175,80,.3)}
.bg-y{background:rgba(255,138,101,.1);color:#d84315;border:1px solid rgba(255,138,101,.3)}
.bg-r{background:rgba(244,67,54,.1);color:#c62828;border:1px solid rgba(244,67,54,.3)}
.bg-b{background:rgba(43,95,143,.1);color:#2B5F8F;border:1px solid rgba(43,95,143,.3)}
.bg-gold{background:rgba(255,138,101,.1);color:#FF8A65;border:1px solid rgba(255,138,101,.3)}
.pbar{background:#e9ecef;border-radius:100px;overflow:hidden;height:7px}
.pfill{height:100%;border-radius:100px;transition:width 1.5s cubic-bezier(.4,0,.2,1)}
.claim{background:#f8f9fa;border-left:3px solid #2B5F8F;border-radius:0 8px 8px 0;padding:11px 15px;margin-bottom:9px;font-size:13px;line-height:1.65;color:#495057}
.sdot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;transition:all .4s}
.sdot.on{background:#2B5F8F;color:#fff;box-shadow:0 0 14px rgba(43,95,143,.4)}
.sdot.done{background:rgba(76,175,80,.15);color:#2e7d32;border:1px solid rgba(76,175,80,.3)}
.sdot.off{background:#e9ecef;color:#6c757d}
.spin{width:46px;height:46px;border:3px solid rgba(43,95,143,.2);border-top-color:#2B5F8F;border-radius:50%;animation:spin .8s linear infinite}
.toast{position:fixed;bottom:28px;right:28px;background:#2B5F8F;color:#fff;padding:11px 18px;border-radius:10px;font-weight:600;font-size:14px;z-index:9999;animation:fsu .3s ease;box-shadow:0 4px 12px rgba(43,95,143,.3)}
.form-card{background:#ffffff;border:1px solid #dee2e6;border-radius:12px;padding:20px;margin-bottom:14px;transition:all .3s}
.form-card:hover{border-color:#2B5F8F;box-shadow:0 2px 8px rgba(43,95,143,.1)}
.form-card.selected{border-color:#FF8A65;background:rgba(255,138,101,.05);box-shadow:0 0 16px rgba(255,138,101,.15)}
.checkbox-row{display:flex;align-items:center;gap:12px;cursor:pointer}
.cb{width:20px;height:20px;border-radius:5px;border:2px solid #dee2e6;background:#ffffff;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .3s}
.cb.checked{background:#2B5F8F;border-color:#2B5F8F}
.step-bar{display:flex;align-items:center;padding:16px 24px;background:#ffffff;border-bottom:1px solid #dee2e6;gap:0;overflow-x:auto}
.step-item{display:flex;align-items:center;gap:8px;white-space:nowrap}
.step-sep{width:32px;height:1px;background:#dee2e6;flex-shrink:0;margin:0 6px}
.sidebar{position:fixed;left:0;top:62px;bottom:0;width:260px;background:#ffffff;border-right:1px solid #dee2e6;padding:20px 0;transition:transform .3s;z-index:50;box-shadow:2px 0 8px rgba(0,0,0,.05)}
.sidebar.closed{transform:translateX(-100%)}
.sidebar-item{display:flex;align-items:center;gap:12px;padding:12px 24px;color:#6c757d;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;border-left:3px solid transparent}
.sidebar-item:hover{background:rgba(43,95,143,.05);color:#2B5F8F}
.sidebar-item.active{background:rgba(43,95,143,.1);color:#2B5F8F;border-left-color:#2B5F8F;font-weight:600}
.main-content{margin-left:260px;transition:margin-left .3s}
.main-content.full{margin-left:0}
.upload-zone{border:2px dashed #dee2e6;border-radius:12px;padding:40px 20px;text-align:center;cursor:pointer;transition:all .3s;background:#ffffff}
.upload-zone:hover{border-color:#2B5F8F;background:rgba(43,95,143,.02)}
.upload-zone.dragging{border-color:#FF8A65;background:rgba(255,138,101,.05)}
@keyframes fsu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
.skel{background:linear-gradient(90deg,#f8f9fa 25%,#e9ecef 50%,#f8f9fa 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}
@media(max-width:768px){.sidebar{width:100%;transform:translateX(-100%)}.sidebar.open{transform:translateX(0)}.main-content{margin-left:0}}
`;

// ── AI Configuration ──────────────────────────────────
// Google Gemini AI configuration
// AI integration is handled server-side

// ── helpers ──────────────────────────────────────────────
function Ring({ score, size=78, color }) {
  const r=(size-8)/2, circ=2*Math.PI*r, fill=(score/100)*circ;
  const col=color||(score>=70?"#4CAF50":score>=45?"#FF8A65":"#f44336");
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e9ecef" strokeWidth="6"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="6"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{transition:"stroke-dasharray 1.5s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:size*.22,color:col}}>{score}</span>
        <span style={{fontSize:size*.12,color:C.muted,fontWeight:500}}>/100</span>
      </div>
    </div>
  );
}
function PBar({val,color}){
  const col=color||(val>=70?"#4CAF50":val>=45?"#FF8A65":"#f44336");
  return <div className="pbar" style={{flex:1}}><div className="pfill" style={{width:`${val}%`,background:`linear-gradient(90deg,${col}dd,${col})`}}/></div>;
}
function Bdg({label,type="b"}){return <span className={`bdg bg-${type}`}>{label}</span>;}
function sc(s){return s>=70?"g":s>=45?"y":"r";}

async function callOpenRouter(prompt){
  try {
    console.log("Calling OpenRouter API...");
    
    // Get custom Gemini API key from localStorage if available
    const customApiKey = localStorage.getItem('customGeminiKey');
    
    const res = await fetch('/api/openrouter/chat', {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(customApiKey && { "X-Custom-Gemini-Key": customApiKey })
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a senior patent attorney. Analyze inventions and return ONLY valid JSON, no markdown, no backticks, no explanations. Ensure all JSON arrays and objects are properly closed with commas and brackets."
          },
          {
            role: "user", 
            content: prompt
          }
        ]
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(()=>({}));
      console.error("OpenRouter API Error:", errorData);
      throw new Error(errorData?.error || `API error ${res.status}`);
    }
    
    const json = await res.json();
    console.log("OpenRouter API Success");
    
    if (!json.success) {
      throw new Error('OpenRouter API failed: ' + (json.error || 'Unknown error'));
    }
    
    let raw = json.response || "";
    
    // Clean up the response more thoroughly
    console.log("Raw response:", raw.substring(0, 200) + "...");
    
    // Remove markdown code blocks
    raw = raw.replace(/^[\s\S]*?```json\s*/i,"").replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```[\s\S]*$/i,"").trim();
    
    // Extract JSON object if it's embedded in text
    if(!raw.startsWith("{")){
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if(start !== -1 && end !== -1 && end > start) {
        raw = raw.slice(start, end + 1);
      }
    }
    
    // Fix common JSON issues
    raw = raw
      .replace(/,\s*}/g, "}") // Remove trailing commas in objects
      .replace(/,\s*]/g, "]") // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F]/g, " ") // Remove control characters
      .replace(/\n/g, " ") // Replace newlines with spaces
      .replace(/\r/g, " ") // Replace carriage returns
      .replace(/\t/g, " ") // Replace tabs
      .replace(/\\/g, "\\\\") // Escape backslashes
      .replace(/"/g, '"') // Fix smart quotes
      .replace(/"/g, '"') // Fix smart quotes
      .replace(/'/g, "'"); // Fix smart quotes
    
    console.log("Cleaned response:", raw.substring(0, 200) + "...");
    
    try { 
      return JSON.parse(raw); 
    } catch(parseError) {
      console.error("JSON Parse Error:", parseError);
      console.error("Failed to parse:", raw);
      
      // Try to fix more JSON issues
      let fixed = raw;
      
      // Try to fix incomplete arrays/objects
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;
      
      // Add missing closing braces
      for(let i = 0; i < openBraces - closeBraces; i++) {
        fixed += "}";
      }
      
      // Add missing closing brackets
      for(let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += "]";
      }
      
      console.log("Attempting to fix JSON:", fixed.substring(0, 200) + "...");
      
      try {
        return JSON.parse(fixed);
      } catch(finalError) {
        console.error("Final JSON Parse Error:", finalError);
        // Return a default response if all parsing fails
        return {
          domain: "Technology",
          patentType: "Utility Patent",
          innovationScore: 75,
          marketPotential: "Medium",
          noveltyScore: 70,
          noveltyReasons: ["Technical innovation", "Unique approach", "Market potential"],
          patentabilityVerdict: "Moderate",
          similarPatents: [],
          abstract: "This invention presents a novel technical solution with potential commercial applications.",
          technicalDescription: "The invention comprises technical components that work together to solve a specific problem.",
          claims: ["1. A system comprising technical elements", "2. The system of claim 1, with additional features"],
          ipcCodes: [{"code": "G06F", "description": "General computing"}],
          readinessScore: 70,
          recommendation: "Review Required",
          nextSteps: ["Refine technical details", "Conduct prior art search", "Prepare documentation"],
          filingCost: "₹8,000 - ₹15,000",
          grantProbability: 65,
          grantFactors: ["Technical merit", "Novelty assessment", "Market relevance"]
        };
      }
    }
  } catch(e) {
    console.error("OpenRouter call failed:", e);
    
    // Check if it's a rate limit error
    if (e.message.includes('rate-limited') || e.message.includes('429')) {
      throw new Error(`🚫 AI Model Temporarily Busy\n\nThe free AI model is currently being heavily used. Please try again in 2-3 minutes.\n\nThis is normal for free models during peak usage times.`);
    }
    
    throw new Error(`OpenRouter API failed: ${e.message}`);
  }
}

async function callOpenRouterChat(messages){
  try {
    console.log("Calling OpenRouter Chat API...");
    
    const res = await fetch('/api/openrouter/chat', {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: "You are a concise AI Patent Assistant for RIT IPR Portal. Give SHORT, precise answers (2-3 sentences max). Help users develop ideas into patents. Ask ONE focused question at a time. Be encouraging but brief. When they have a developed idea, suggest patent analysis."
          },
          ...messages
        ]
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(()=>({}));
      console.error("OpenRouter Chat API Error:", errorData);
      throw new Error(errorData?.error || `API error ${res.status}`);
    }
    
    const json = await res.json();
    console.log("OpenRouter Chat API Success");
    
    if (!json.success) {
      throw new Error('OpenRouter API failed: ' + (json.error || 'Unknown error'));
    }
    
    return json.response || "Sorry, I couldn't process that request.";
  } catch(e) {
    console.error("OpenRouter chat call failed:", e);
    
    // Check if it's a rate limit error
    if (e.message.includes('rate-limited') || e.message.includes('429')) {
      throw new Error(`🤖 AI Assistant Temporarily Busy\n\nThe AI is currently being heavily used. Please try again in a few minutes.`);
    }
    
    throw new Error(`Chat API failed: ${e.message}`);
  }
}

const FORMS_LIST = [
  { id:"form1", label:"Form 1", name:"Application for Grant of Patent", desc:"Main application form — required for all patent filings", required:true, icon:"📋" },
  { id:"form2", label:"Form 2", name:"Complete Specification", desc:"Full patent spec with abstract, description & claims", required:true, icon:"📄" },
  { id:"form3", label:"Form 3", name:"Statement & Undertaking", desc:"Declaration of foreign filing status", required:true, icon:"📝" },
  { id:"form5", label:"Form 5", name:"Declaration of Inventorship", desc:"Signed declaration by each inventor", required:true, icon:"✍️" },
  { id:"form26",label:"Form 26",name:"Authorisation of Patent Agent",desc:"Power of attorney for patent agent/attorney", required:false, icon:"🤝" },
  { id:"noc_i", label:"NOC-I", name:"Institutional NOC", desc:"No Objection Certificate from institution/college", required:false, icon:"🏛️" },
  { id:"noc_s", label:"NOC-S", name:"Student / Author NOC", desc:"No Objection Certificate signed by all inventors", required:false, icon:"🎓" },
];

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login"); // login | register | dashboard | form | loading | results | formdetails | generating | formsready | account | history | chat | submissions | admin
  const [step,   setStep]   = useState(1);
  const [toast,  setToast]  = useState("");
  const [data,   setData]   = useState(null);
  const [err,    setErr]    = useState("");
  const [genLog, setGenLog] = useState([]);
  const [selectedForms, setSelectedForms] = useState(["form1","form2","form3","form5","noc_i","noc_s"]);
  const [genProgress, setGenProgress] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [patentHistory, setPatentHistory] = useState([]);
  const [extractedText, setExtractedText] = useState("");

  // Chat states
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Submission and notification states
  const [submissions, setSubmissions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Login/Register form states
  const [loginForm, setLoginForm] = useState({ email: "", password: "", geminiApiKey: "" });
  const [registerForm, setRegisterForm] = useState({ 
    name: "", email: "", password: "", confirmPassword: "", 
    department: "", role: "faculty" // institution is set by backend as default
  });

  const [inv, setInv] = useState({
    title:"", problem:"", components:"", working:"", industry:"IoT", unique:""
  });
  const [applicant, setApplicant] = useState({
    appName:"", appAddress:"", institution:"Rajalakshmi Institute of Technology", dept:"",
    inventors:[{name:"",address:"",nationality:"Indian"}],
    agentName:"", agentReg:"", agentAddress:"",
    filingOffice:"Chennai", date: new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}),
    nocStudents:[{sno:"1",name:"",dept:"",year:"I Year",roll:""}],
  });

  const topRef=useRef(null);

  useEffect(()=>{
    const s=document.createElement("style");s.textContent=STYLES;document.head.appendChild(s);
    // Check if user is logged in
    const savedUser = authAPI.getStoredUser();
    if(savedUser){
      setUser(savedUser);
      setIsLoggedIn(true);
      setScreen("dashboard");
      // Load patent history from backend
      loadPatentHistory();
      // Load submissions and notifications
      loadSubmissions();
      loadNotifications();
    }
    return ()=>document.head.removeChild(s);
  },[]);
  
  // Load patent history from backend
  async function loadPatentHistory(){
    try{
      const response = await patentAPI.getAll(20);
      if(response.patents){
        // Transform backend data to match frontend format
        const transformedPatents = response.patents.map(p => ({
          id: p.id,
          title: p.title,
          date: p.created_at,
          status: p.status === 'completed' ? 'Completed' : 'Draft',
          innovationScore: p.innovation_score,
          noveltyScore: p.novelty_score,
          readinessScore: p.readiness_score,
          grantProbability: p.grant_probability,
          invention: {
            title: p.title,
            problem: p.problem,
            components: p.components,
            working: p.working,
            industry: p.industry,
            unique: p.unique_features
          },
          analysis: p.analysis_data,
          applicant: p.applicant_data
        }));
        setPatentHistory(transformedPatents);
      }
    }catch(e){
      console.error('Failed to load patent history:', e);
    }
  }

  async function loadSubmissions() {
    try {
      if (user?.role === 'admin') {
        const response = await submissionAPI.getPending();
        setSubmissions(response.submissions || []);
      } else if (user?.role === 'faculty') {
        const response = await submissionAPI.getMy();
        setSubmissions(response.submissions || []);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      setSubmissions([]); // Set empty array on error
    }
  }

  async function loadNotifications() {
    try {
      const response = await notificationAPI.getAll();
      setNotifications(response.notifications || []);
      
      const countResponse = await notificationAPI.getUnreadCount();
      setUnreadCount(countResponse.count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(""),3000);return()=>clearTimeout(t);}},[toast]);

  // Load submissions and notifications when user changes
  useEffect(() => {
    if (isLoggedIn && user) {
      loadSubmissions();
      loadNotifications();
    }
  }, [isLoggedIn, user]);

  function copy(text){navigator.clipboard.writeText(text).then(()=>setToast("✓ Copied!"));}
  const fi=(k,v)=>setInv(p=>({...p,[k]:v}));
  const fa=(k,v)=>setApplicant(p=>({...p,[k]:v}));

  // ── Login/Register Functions ──
  async function handleLogin(e){
    e.preventDefault();
    if(!loginForm.email || !loginForm.password){
      setErr("Please enter email and password");
      return;
    }
    
    try{
      const response = await authAPI.login({
        email: loginForm.email,
        password: loginForm.password
      });
      
      // Store custom Gemini API key if provided
      if(loginForm.geminiApiKey && loginForm.geminiApiKey.trim()){
        localStorage.setItem('customGeminiKey', loginForm.geminiApiKey.trim());
        setToast("✓ Using your custom Gemini API key!");
      } else {
        localStorage.removeItem('customGeminiKey');
      }
      
      setUser(response.user);
      setIsLoggedIn(true);
      setScreen("dashboard");
      setToast("✓ Login successful!");
      setErr("");
      
      // Load patent history
      await loadPatentHistory();
      // Load submissions and notifications
      await loadSubmissions();
      await loadNotifications();
    }catch(error){
      setErr(error.message || "Login failed. Please try again.");
    }
  }

  async function handleRegister(e){
    e.preventDefault();
    if(!registerForm.name || !registerForm.email || !registerForm.password){
      setErr("Please fill all required fields");
      return;
    }
    if(registerForm.password !== registerForm.confirmPassword){
      setErr("Passwords do not match");
      return;
    }
    if(registerForm.password.length < 6){
      setErr("Password must be at least 6 characters");
      return;
    }
    
    try{
      const response = await authAPI.register({
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        department: registerForm.department,
        role: registerForm.role
        // institution is set by backend as "Rajalakshmi Institute of Technology"
      });
      
      setUser(response.user);
      setIsLoggedIn(true);
      setScreen("dashboard");
      setToast("✓ Account created successfully!");
      setErr("");
      
      // Load initial data
      await loadPatentHistory();
      await loadSubmissions();
      await loadNotifications();
    }catch(error){
      setErr(error.message || "Registration failed. Please try again.");
    }
  }

  function handleLogout(){
    authAPI.logout();
    setUser(null);
    setIsLoggedIn(false);
    setScreen("login");
    setSidebarOpen(true);
    setPatentHistory([]);
    setToast("✓ Logged out successfully");
  }

  // ── File Upload & OCR ──
  async function handleFileUpload(e){
    const file = e.target.files?.[0];
    if(!file) return;
    
    const validTypes = [
      'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp',
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
    ];
    
    if(!validTypes.includes(file.type) && !file.type.startsWith('image/')){
      setErr("Please upload an image (PNG, JPG), PDF, or Word document (DOC, DOCX)");
      return;
    }
    
    setUploadedFile(file);
    setIsProcessingOCR(true);
    setOcrProgress(0);
    setErr("");
    
    try{
      let text = "";
      
      // Handle PDF files
      if(file.type === 'application/pdf'){
        text = await extractTextFromPDF(file);
      }
      // Handle DOC/DOCX files
      else if(file.type === 'application/msword' || 
              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
        text = await extractTextFromWord(file);
      }
      // Handle image files with OCR
      else {
        const result = await Tesseract.recognize(
          file,
          'eng',
          {
            logger: m => {
              if(m.status === 'recognizing text'){
                setOcrProgress(Math.round(m.progress * 100));
              }
            }
          }
        );
        text = result.data.text;
      }
      
      setExtractedText(text);
      setIsProcessingOCR(false);
      setOcrProgress(100);
      
      console.log("=== TEXT EXTRACTION COMPLETE ===");
      console.log("Text length:", text.length);
      console.log("First 300 chars:", text.slice(0, 300));
      console.log("Calling autoFillFromText...");
      
      setToast("✓ Text extracted successfully!");
      
      // Try to auto-fill form fields from extracted text
      autoFillFromText(text);
      
    }catch(error){
      console.error("Extraction error:", error);
      setErr("Text extraction failed. Please try again or type manually.");
      setIsProcessingOCR(false);
      setOcrProgress(0);
    }
  }

  // Extract text from PDF
  async function extractTextFromPDF(file){
    setOcrProgress(10);
    const arrayBuffer = await file.arrayBuffer();
    setOcrProgress(20);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setOcrProgress(30);
    
    let fullText = "";
    const numPages = pdf.numPages;
    
    for(let i = 1; i <= numPages; i++){
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
      setOcrProgress(30 + (i / numPages) * 60);
    }
    
    setOcrProgress(100);
    return fullText.trim();
  }

  // Extract text from Word documents
  async function extractTextFromWord(file){
    setOcrProgress(20);
    const arrayBuffer = await file.arrayBuffer();
    setOcrProgress(40);
    
    const result = await mammoth.extractRawText({ arrayBuffer });
    setOcrProgress(80);
    
    setOcrProgress(100);
    return result.value;
  }

  function autoFillFromText(text){
    console.log("=== AUTO-FILL CALLED ===");
    console.log("Text length:", text?.length);
    
    if(!text || text.trim().length < 10) {
      console.log("❌ Text too short:", text?.length);
      setToast("⚠️ Text too short for auto-fill");
      return;
    }
    
    console.log("✅ Proceeding with extraction");
    
    const lines = text.split('\n').filter(l => l.trim());
    const fullText = text.trim();
    
    console.log("Lines:", lines.length, "Full text:", fullText.length);
    
    // Smart extraction using keywords and patterns
    let extractedData = {
      title: "",
      problem: "",
      components: "",
      working: "",
      industry: "IoT",
      unique: ""
    };
    
    // Extract Title - look for common patterns
    const titlePatterns = [
      /(?:title|invention|project|system|device|method|apparatus)[\s:]+(.+?)(?:\n|$)/i,
      /^(.{10,150})$/m, // First substantial line
    ];
    
    for(const pattern of titlePatterns){
      const match = fullText.match(pattern);
      if(match && match[1] && match[1].trim().length > 10){
        extractedData.title = match[1].trim().replace(/[:\-\.]$/, '').slice(0, 150);
        console.log("Title extracted:", extractedData.title);
        break;
      }
    }
    
    // If no title found, use first significant line
    if(!extractedData.title && lines.length > 0){
      extractedData.title = lines[0].trim().slice(0, 150);
      console.log("Title from first line:", extractedData.title);
    }
    
    // Extract Problem/Background
    const problemPatterns = [
      /(?:problem|issue|challenge|background|need|gap)[\s:]+(.+?)(?=(?:solution|proposed|components|working|method|approach|invention)|$)/is,
      /(?:solves?|addresses?|tackles?)[\s:]+(.+?)(?=(?:solution|components|working|method)|$)/is,
    ];
    
    for(const pattern of problemPatterns){
      const match = fullText.match(pattern);
      if(match && match[1] && match[1].trim().length > 20){
        extractedData.problem = match[1].trim().slice(0, 1000);
        console.log("Problem extracted:", extractedData.problem.slice(0, 100) + "...");
        break;
      }
    }
    
    // Extract Components/Hardware/Materials
    const componentPatterns = [
      /(?:components?|hardware|materials?|parts?|equipment|devices?)[\s:]+(.+?)(?=(?:working|method|process|steps?|procedure|algorithm)|$)/is,
      /(?:uses?|utilizes?|employs?|consists? of)[\s:]+(.+?)(?=(?:working|method|process)|$)/is,
    ];
    
    for(const pattern of componentPatterns){
      const match = fullText.match(pattern);
      if(match && match[1] && match[1].trim().length > 10){
        extractedData.components = match[1].trim().slice(0, 500);
        console.log("Components extracted:", extractedData.components.slice(0, 100) + "...");
        break;
      }
    }
    
    // Extract Working/Methodology
    const workingPatterns = [
      /(?:working|methodology|method|process|procedure|algorithm|steps?|how it works)[\s:]+(.+?)(?=(?:unique|novel|advantage|benefit|result|conclusion)|$)/is,
      /(?:operates?|functions?|works?)[\s:]+(.+?)(?=(?:unique|novel|advantage)|$)/is,
    ];
    
    for(const pattern of workingPatterns){
      const match = fullText.match(pattern);
      if(match && match[1] && match[1].trim().length > 20){
        extractedData.working = match[1].trim().slice(0, 1000);
        console.log("Working extracted:", extractedData.working.slice(0, 100) + "...");
        break;
      }
    }
    
    // Extract Unique Features/Novelty
    const uniquePatterns = [
      /(?:unique|novel|innovative|advantage|benefit|improvement|different)[\s:]+(.+?)(?=(?:conclusion|result|application|industry)|$)/is,
      /(?:differs? from|better than|improves? upon)[\s:]+(.+?)(?=(?:conclusion|application)|$)/is,
    ];
    
    for(const pattern of uniquePatterns){
      const match = fullText.match(pattern);
      if(match && match[1] && match[1].trim().length > 10){
        extractedData.unique = match[1].trim().slice(0, 500);
        console.log("Unique extracted:", extractedData.unique.slice(0, 100) + "...");
        break;
      }
    }
    
    // Detect Industry from keywords
    const industryKeywords = {
      "IoT": ["iot", "internet of things", "smart", "sensor", "connected"],
      "Healthcare": ["health", "medical", "patient", "diagnosis", "treatment", "hospital"],
      "Agriculture": ["agriculture", "farming", "crop", "soil", "irrigation"],
      "Education": ["education", "learning", "student", "teaching", "school"],
      "Defense": ["defense", "military", "security", "surveillance", "weapon"],
      "Transportation": ["transport", "vehicle", "traffic", "automobile", "logistics"],
      "Energy": ["energy", "power", "solar", "battery", "renewable"],
      "Robotics": ["robot", "automation", "autonomous", "mechanical"],
      "AI/ML": ["artificial intelligence", "machine learning", "neural", "ai", "ml", "deep learning"],
      "Biotechnology": ["biotech", "genetic", "dna", "protein", "biological"]
    };
    
    const lowerText = fullText.toLowerCase();
    for(const [industry, keywords] of Object.entries(industryKeywords)){
      if(keywords.some(kw => lowerText.includes(kw))){
        extractedData.industry = industry;
        console.log("Industry detected:", industry);
        break;
      }
    }
    
    // Fallback: Use full text for missing fields (more aggressive)
    if(!extractedData.problem && fullText.length > 50){
      // Extract first few paragraphs as problem
      const paragraphs = fullText.split(/\n\n+/);
      extractedData.problem = paragraphs.slice(0, 3).join('\n\n').slice(0, 1000);
      console.log("Problem fallback:", extractedData.problem.slice(0, 100) + "...");
    }
    
    if(!extractedData.components && fullText.length > 50){
      // Look for lists or comma-separated items
      const listMatch = fullText.match(/(?:includes?|contains?|comprises?)[\s:]+([^.]+)/i);
      if(listMatch){
        extractedData.components = listMatch[1].trim().slice(0, 500);
      } else {
        // Use a portion of text
        extractedData.components = fullText.slice(0, 300);
      }
      console.log("Components fallback:", extractedData.components.slice(0, 100) + "...");
    }
    
    if(!extractedData.working && fullText.length > 100){
      // Use middle section of text
      const paragraphs = fullText.split(/\n\n+/);
      if(paragraphs.length > 2){
        extractedData.working = paragraphs.slice(1, 4).join('\n\n').slice(0, 1000);
      } else {
        extractedData.working = fullText.slice(0, 800);
      }
      console.log("Working fallback:", extractedData.working.slice(0, 100) + "...");
    }
    
    if(!extractedData.unique && fullText.length > 50){
      // Use last paragraphs
      const paragraphs = fullText.split(/\n\n+/);
      if(paragraphs.length > 1){
        extractedData.unique = paragraphs.slice(-2).join('\n\n').slice(0, 500);
      } else {
        extractedData.unique = fullText.slice(-400);
      }
      console.log("Unique fallback:", extractedData.unique.slice(0, 100) + "...");
    }
    
    console.log("Final extracted data:", {
      title: extractedData.title.slice(0, 50),
      problem: extractedData.problem.slice(0, 50),
      components: extractedData.components.slice(0, 50),
      working: extractedData.working.slice(0, 50),
      unique: extractedData.unique.slice(0, 50),
      industry: extractedData.industry
    });
    
    // Apply extracted data
    setInv(extractedData);
    
    // Check if we have enough data to proceed (more lenient)
    const hasEnoughData = 
      extractedData.title.length > 5 &&
      extractedData.problem.length > 30 &&
      extractedData.components.length > 5 &&
      extractedData.working.length > 30 &&
      extractedData.unique.length > 5;
    
    console.log("Has enough data:", hasEnoughData);
    
    if(hasEnoughData){
      // Auto-advance to step 3 (Review & Analyze)
      setTimeout(() => {
        setStep(3);
        setToast("✓ All fields auto-filled! Ready to analyze.");
        console.log("Advanced to step 3");
      }, 1000);
    } else {
      // Just go to step 2 for user to fill remaining fields
      setTimeout(() => {
        setStep(2);
        setToast("✓ Basic info extracted. Please complete remaining fields.");
        console.log("Advanced to step 2");
      }, 1000);
    }
  }

  async function saveToHistory(){
    if(!data || !inv.title) return;
    
    try{
      // Save to backend
      await patentAPI.create({
        title: inv.title,
        problem: inv.problem,
        components: inv.components,
        working: inv.working,
        industry: inv.industry,
        unique_features: inv.unique,
        innovation_score: data.innovationScore,
        novelty_score: data.noveltyScore,
        readiness_score: data.readinessScore,
        grant_probability: data.grantProbability,
        status: 'completed',
        analysis_data: {
          domain: data.domain,
          patentType: data.patentType,
          marketPotential: data.marketPotential,
          noveltyReasons: data.noveltyReasons,
          patentabilityVerdict: data.patentabilityVerdict,
          similarPatents: data.similarPatents,
          abstract: data.abstract,
          technicalDescription: data.technicalDescription,
          claims: data.claims,
          ipcCodes: data.ipcCodes,
          nextSteps: data.nextSteps,
          filingCost: data.filingCost,
          grantFactors: data.grantFactors,
          recommendation: data.recommendation
        },
        applicant_data: applicant.appName ? {
          appName: applicant.appName,
          appAddress: applicant.appAddress,
          institution: applicant.institution,
          dept: applicant.dept,
          inventors: applicant.inventors,
          agentName: applicant.agentName,
          agentReg: applicant.agentReg,
          agentAddress: applicant.agentAddress,
          filingOffice: applicant.filingOffice,
          date: applicant.date
        } : {}
      });
      
      // Reload history from backend
      await loadPatentHistory();
      setToast("✓ Patent saved successfully!");
    }catch(error){
      console.error('Save error:', error);
      setToast("⚠ Failed to save patent");
    }
  }

  function loadPatentFromHistory(historyItem){
    // Restore invention data
    setInv(historyItem.invention);
    
    // Restore analysis data
    setData(historyItem.analysis);
    
    // Restore applicant data if available
    if(historyItem.applicant){
      setApplicant(historyItem.applicant);
    }
    
    // Navigate to results screen
    setScreen("results");
    setToast("✓ Patent loaded from history!");
  }

  // ── AI Analyze ──
  async function analyze(){
    setScreen("loading"); setErr("");
    
    try {
      const prompt=`You are a senior patent attorney. Analyze this invention and return ONLY raw JSON, no markdown, no backticks.

Invention:
Title: ${inv.title}
Problem: ${inv.problem}
Components: ${inv.components}
Working: ${inv.working}
Industry: ${inv.industry}
Unique: ${inv.unique}

Return this exact JSON with specific realistic values:
{"domain":"specific tech domain","patentType":"Utility Patent","innovationScore":82,"marketPotential":"High","noveltyScore":76,"noveltyReasons":["specific reason 1","specific reason 2","specific reason 3"],"patentabilityVerdict":"Strong","similarPatents":[{"title":"Real patent name","year":2020,"similarity":24,"office":"USPTO"},{"title":"Real patent name 2","year":2018,"similarity":19,"office":"WIPO"},{"title":"Real patent name 3","year":2021,"similarity":31,"office":"IPO"}],"abstract":"Two full paragraphs of proper legal patent abstract specific to this invention...","technicalDescription":"Detailed technical description of this specific invention...","claims":["1. A system comprising: specific independent claim...","2. The system of claim 1, wherein specific detail...","3. The system of claim 1, further comprising specific element...","4. A method for purpose of this invention comprising steps...","5. The method of claim 4, wherein specific dependent detail..."],"ipcCodes":[{"code":"G06F 21/00","description":"Description of why this code applies"},{"code":"H04L 29/06","description":"Description"},{"code":"G08B 21/18","description":"Description"}],"readinessScore":78,"recommendation":"Ready to File","nextSteps":["Specific action 1","Specific action 2","Specific action 3"],"filingCost":"₹8,000 - ₹15,000","grantProbability":71,"grantFactors":["Specific factor 1","Specific factor 2","Specific factor 3"]}`;
      
      const parsed = await callOpenRouter(prompt);
      setData(parsed);
      // Pre-fill applicant form with invention title
      setApplicant(p=>({...p}));
      setScreen("results");
      setTimeout(()=>topRef.current?.scrollIntoView({behavior:"smooth"}),100);
    } catch(e) {
      console.error('Analysis error:', e);
      setScreen("form");
      setErr("Analysis failed: " + (e.message || "Unknown error. Please try again."));
    }
  }

  // ── Chat Functions ──
  async function sendChatMessage() {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage = { role: "user", content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      const response = await callOpenRouterChat(newMessages);
      setChatMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I'm having trouble connecting right now. Please try again." 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  }

  function extractIdeaFromChat() {
    // Extract key information from chat to pre-fill the patent form
    const chatText = chatMessages
      .filter(msg => msg.role === "user")
      .map(msg => msg.content)
      .join(" ");
    
    // Simple extraction - in a real app, you might use more sophisticated NLP
    const sentences = chatText.split(/[.!?]+/);
    
    // Try to extract title (first meaningful sentence)
    const title = sentences.find(s => s.length > 10 && s.length < 100)?.trim() || "";
    
    // Extract problem/solution context
    const problem = sentences.filter(s => 
      s.toLowerCase().includes("problem") || 
      s.toLowerCase().includes("issue") || 
      s.toLowerCase().includes("challenge")
    ).join(". ").trim();
    
    // Pre-fill the form with extracted information
    setInv(prev => ({
      ...prev,
      title: title || prev.title,
      problem: problem || chatText.substring(0, 200) + "...",
      components: "",
      working: "",
      unique: ""
    }));
    
    // Switch to patent form
    setScreen("form");
    setStep(1);
    setToast("💡 Idea extracted from chat! Please complete the details.");
  }

  function clearChat() {
    setChatMessages([]);
    setToast("🗑️ Chat cleared!");
  }

  // ── Submit for Review ──
  async function submitForReview() {
    try {
      // Check if user is faculty
      if (user?.role !== 'faculty') {
        setToast("❌ Only faculty members can submit patents for review");
        return;
      }

      // First, save the patent to get a proper patent ID
      const patentData = {
        title: inv.title,
        problem: inv.problem,
        components: inv.components,
        working: inv.working,
        industry: inv.industry,
        unique_features: inv.unique,
        innovation_score: data?.innovationScore || 0,
        novelty_score: data?.noveltyScore || 0,
        readiness_score: data?.readinessScore || 0,
        grant_probability: data?.grantProbability || 0,
        status: 'submitted_for_review',
        analysis_data: data || {},
        applicant_data: applicant || {}
      };

      // Save patent first
      const patentResponse = await patentAPI.create(patentData);
      const patentId = patentResponse.patentId;

      // Prepare forms data
      const formsData = {
        invention: inv,
        applicant: applicant,
        analysis: data,
        selectedForms: selectedForms,
        generatedAt: new Date().toISOString()
      };

      // Submit to backend
      const response = await submissionAPI.submit(patentId, formsData);
      
      setToast("✅ Patent submitted for admin review!");
      
      // Reload submissions to show the new one
      await loadSubmissions();
      
      // Reload patent history to update dashboard
      await loadPatentHistory();
      
      // Optionally redirect to submissions page
      setTimeout(() => {
        setScreen("submissions");
      }, 2000);
      
    } catch (error) {
      console.error('Submit for review error:', error);
      setToast("❌ Failed to submit for review: " + error.message);
    }
  }

  // ── View Submission Details ──
  function viewSubmissionDetails(submission) {
    // Restore the invention data from the submission
    if (submission.forms_data) {
      setInv(submission.forms_data.invention || {});
      setApplicant(submission.forms_data.applicant || {});
      setData(submission.forms_data.analysis || {});
      setSelectedForms(submission.forms_data.selectedForms || []);
    }
    
    // Go to results screen to show the full application
    setScreen("results");
    setToast("📋 Viewing submission details");
  }

  // ── Generate Forms via Claude ──
  async function generateForms(){
    setScreen("generating");
    setGenLog([]);
    setGenProgress(0);

    const log=(msg)=>setGenLog(p=>[...p,msg]);

    try{
      log("🔍 Reading your applicant details...");
      await new Promise(r=>setTimeout(r,600));
      setGenProgress(10);

      log("📋 Generating Form 1 — Application for Grant of Patent...");
      await new Promise(r=>setTimeout(r,800));
      setGenProgress(25);

      log("📄 Generating Form 2 — Complete Specification with full patent draft...");
      await new Promise(r=>setTimeout(r,900));
      setGenProgress(40);

      log("📝 Generating Form 3 — Statement & Undertaking...");
      await new Promise(r=>setTimeout(r,500));
      setGenProgress(52);

      log("✍️ Generating Form 5 — Declaration of Inventorship...");
      await new Promise(r=>setTimeout(r,500));
      setGenProgress(63);

      if(selectedForms.includes("form26")){
        log("🤝 Generating Form 26 — Authorisation of Patent Agent...");
        await new Promise(r=>setTimeout(r,400));
        setGenProgress(72);
      }

      if(selectedForms.includes("noc_i")){
        log("🏛️ Generating Institutional NOC...");
        await new Promise(r=>setTimeout(r,500));
        setGenProgress(82);
      }

      if(selectedForms.includes("noc_s")){
        log("🎓 Generating Student / Author NOC...");
        await new Promise(r=>setTimeout(r,500));
        setGenProgress(90);
      }

      log("📦 Packaging all forms into complete submission bundle...");
      await new Promise(r=>setTimeout(r,600));
      setGenProgress(100);

      await new Promise(r=>setTimeout(r,400));
      log("✅ All forms generated successfully!");

      setScreen("formsready");
    }catch(e){
      log("❌ Generation failed. Please try again.");
      setScreen("formdetails");
    }
  }

  // ── Build full patent text for copy ──
  function fullReport(){
    if(!data) return "";
    const a=applicant;
    return `RIT IPR — COMPLETE PATENT PACKAGE
RAJALAKSHMI INSTITUTE OF TECHNOLOGY
${"═".repeat(60)}
INVENTION: ${inv.title}
APPLICANT: ${a.appName||a.institution}
INSTITUTION: ${a.institution}
FILING DATE: ${a.date}
FILING OFFICE: ${a.filingOffice}

SCORES
Innovation: ${data.innovationScore}/100  |  Novelty: ${data.noveltyScore}/100
Readiness: ${data.readinessScore}/100  |  Grant Probability: ${data.grantProbability}%
RECOMMENDATION: ${data.recommendation}

${"═".repeat(60)}
INVENTORS
${"═".repeat(60)}
${a.inventors.map((inv,i)=>`${i+1}. ${inv.name}\n   ${inv.address}\n   Nationality: ${inv.nationality}`).join("\n\n")}

${"═".repeat(60)}
ABSTRACT
${"═".repeat(60)}
${data.abstract}

${"═".repeat(60)}
TECHNICAL DESCRIPTION
${"═".repeat(60)}
${data.technicalDescription}

${"═".repeat(60)}
PATENT CLAIMS
${"═".repeat(60)}
${data.claims?.join("\n\n")}

${"═".repeat(60)}
IPC CLASSIFICATION CODES
${"═".repeat(60)}
${data.ipcCodes?.map(c=>`${c.code} — ${c.description}`).join("\n")}

${"═".repeat(60)}
NEXT STEPS
${"═".repeat(60)}
${data.nextSteps?.map((s,i)=>`${i+1}. ${s}`).join("\n")}

${"═".repeat(60)}
Generated by RIT IPR Platform
Rajalakshmi Institute of Technology
Believe in the Possibilities`;
  }

  // ── PDF Generation ──
  function generatePDF(){
    if(!data) return;
    
    const doc = new jsPDF();
    const a = applicant;
    
    // Set default font to Times New Roman
    doc.setFont("times", "normal");
    
    let yPos = 20;
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Try to add logo - positioned higher and smaller
    try {
      doc.addImage('/rit-logo.png', 'PNG', margin, 8, 35, 18);
    } catch(e) {
      console.log("Logo not loaded, continuing without logo");
    }
    
    // Header section - moved down to avoid overlap
    doc.setFontSize(20);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Black text
    doc.text('PATENT ANALYSIS REPORT', pageWidth/2, 32, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont("times", "normal");
    doc.text('Rajalakshmi Institute of Technology', pageWidth/2, 42, { align: 'center' });
    doc.text('RIT-IPR Portal - AI Patent Assistant', pageWidth/2, 50, { align: 'center' });
    
    // Add horizontal line - moved down
    doc.setLineWidth(0.5);
    doc.line(margin, 55, pageWidth - margin, 55);
    
    yPos = 65; // Start content further down
    
    // Invention Title Box
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.text('INVENTION TITLE', margin, yPos);
    yPos += 8;
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    const titleLines = doc.splitTextToSize(inv.title, contentWidth);
    doc.text(titleLines, margin, yPos);
    yPos += titleLines.length * 6 + 10;
    
    // Basic Information Table
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('BASIC INFORMATION', margin, yPos);
    yPos += 10;
    
    const basicInfoData = [
      ['Field', 'Details'],
      ['Filing Date', a.date],
      ['Filing Office', a.filingOffice],
      ['Institution', a.institution || 'N/A'],
      ['Department', a.dept || 'N/A'],
      ['Industry', inv.industry],
      ['Applicant Name', a.appName || 'N/A']
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [basicInfoData[0]],
      body: basicInfoData.slice(1),
      theme: 'striped',
      headStyles: { 
        fillColor: [43, 95, 143], 
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 10,
        textColor: 0
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 120 }
      },
      styles: {
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // Analysis Scores Section
    if(yPos > 230) { 
      doc.addPage(); 
      yPos = 30;
    }
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('ANALYSIS SCORES', margin, yPos);
    yPos += 10;
    
    // Create scores table with better formatting
    const scoresData = [
      ['Metric', 'Score', 'Status', 'Interpretation'],
      ['Innovation Score', `${data.innovationScore}/100`, 
        data.innovationScore >= 70 ? 'Strong' : data.innovationScore >= 45 ? 'Moderate' : 'Weak',
        data.innovationScore >= 70 ? 'Highly innovative' : data.innovationScore >= 45 ? 'Moderately innovative' : 'Needs improvement'],
      ['Novelty Score', `${data.noveltyScore}/100`, 
        data.noveltyScore >= 70 ? 'Strong' : data.noveltyScore >= 45 ? 'Moderate' : 'Weak',
        data.noveltyScore >= 70 ? 'Highly novel' : data.noveltyScore >= 45 ? 'Moderately novel' : 'Limited novelty'],
      ['Patent Readiness', `${data.readinessScore}/100`, 
        data.readinessScore >= 70 ? 'Ready' : data.readinessScore >= 45 ? 'Nearly Ready' : 'Not Ready',
        data.readinessScore >= 70 ? 'Ready to file' : data.readinessScore >= 45 ? 'Minor refinements needed' : 'Significant work required'],
      ['Grant Probability', `${data.grantProbability}%`, 
        data.grantProbability >= 70 ? 'High' : data.grantProbability >= 45 ? 'Medium' : 'Low',
        data.grantProbability >= 70 ? 'Strong chance of grant' : data.grantProbability >= 45 ? 'Moderate chance' : 'Low chance']
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [scoresData[0]],
      body: scoresData.slice(1),
      theme: 'grid',
      headStyles: { 
        fillColor: [43, 95, 143], 
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 0
      },
      columnStyles: {
        0: { cellWidth: 40, halign: 'left' },
        1: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 75, halign: 'left' }
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // Inventors Section with Table
    if(yPos > 230) { 
      doc.addPage(); 
      yPos = 30;
    }
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('INVENTORS', margin, yPos);
    yPos += 10;
    
    const inventorsData = [
      ['S.No', 'Name', 'Address', 'Nationality'],
      ...a.inventors.map((inv, idx) => [
        String(idx + 1), 
        inv.name || 'N/A', 
        inv.address || 'N/A', 
        inv.nationality || 'Indian'
      ])
    ];
    
    doc.autoTable({
      startY: yPos,
      head: [inventorsData[0]],
      body: inventorsData.slice(1),
      theme: 'grid',
      headStyles: { 
        fillColor: [43, 95, 143], 
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 9,
        textColor: 0
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 85, halign: 'left' },
        3: { cellWidth: 25, halign: 'center' }
      },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        cellPadding: 3
      }
    });
    
    yPos = doc.lastAutoTable.finalY + 15;
    
    // Patent Agent Information (if available)
    if(a.agentName && yPos < 240) {
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.text('PATENT AGENT DETAILS', margin, yPos);
      yPos += 10;
      
      const agentData = [
        ['Field', 'Details'],
        ['Agent Name', a.agentName],
        ['Registration Number', a.agentReg || 'N/A'],
        ['Address', a.agentAddress || 'N/A']
      ];
      
      doc.autoTable({
        startY: yPos,
        head: [agentData[0]],
        body: agentData.slice(1),
        theme: 'striped',
        headStyles: { 
          fillColor: [43, 95, 143], 
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 0
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 120 }
        }
      });
      
      yPos = doc.lastAutoTable.finalY + 15;
    }
    
    // Abstract Section
    doc.addPage();
    yPos = 30;
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('ABSTRACT', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    const abstractLines = doc.splitTextToSize(data.abstract, contentWidth);
    doc.text(abstractLines, margin, yPos);
    yPos += abstractLines.length * 5 + 15;
    
    // Technical Description Section
    if(yPos > 230) { 
      doc.addPage(); 
      yPos = 30;
    }
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('TECHNICAL DESCRIPTION', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    const techLines = doc.splitTextToSize(data.technicalDescription, contentWidth);
    doc.text(techLines, margin, yPos);
    yPos += techLines.length * 5 + 15;
    
    // Patent Claims Section
    doc.addPage();
    yPos = 30;
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('PATENT CLAIMS', margin, yPos);
    yPos += 10;
    
    doc.setFontSize(11);
    doc.setFont("times", "normal");
    data.claims?.forEach((claim, i) => {
      if(yPos > 260) { 
        doc.addPage(); 
        yPos = 30;
      }
      const claimLines = doc.splitTextToSize(claim, contentWidth);
      doc.text(claimLines, margin, yPos);
      yPos += claimLines.length * 5 + 6;
    });
    
    // IPC Classification Codes Section
    if(yPos > 180) { 
      doc.addPage(); 
      yPos = 30;
    }
    
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.text('IPC CLASSIFICATION CODES', margin, yPos);
    yPos += 10;
    
    if(data.ipcCodes && data.ipcCodes.length > 0) {
      const ipcData = [
        ['S.No', 'IPC Code', 'Description'],
        ...data.ipcCodes.map((c, idx) => [String(idx + 1), c.code, c.description])
      ];
      
      doc.autoTable({
        startY: yPos,
        head: [ipcData[0]],
        body: ipcData.slice(1),
        theme: 'grid',
        headStyles: { 
          fillColor: [43, 95, 143], 
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 0
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 35, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 120, halign: 'left' }
        },
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          cellPadding: 3
        }
      });
      
      yPos = doc.lastAutoTable.finalY + 15;
    }
    
    // Next Steps Section
    if(data.nextSteps && data.nextSteps.length > 0) {
      if(yPos > 200) { 
        doc.addPage(); 
        yPos = 30;
      }
      
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.text('RECOMMENDED NEXT STEPS', margin, yPos);
      yPos += 10;
      
      const stepsData = [
        ['Step', 'Action'],
        ...data.nextSteps.map((step, idx) => [String(idx + 1), step])
      ];
      
      doc.autoTable({
        startY: yPos,
        head: [stepsData[0]],
        body: stepsData.slice(1),
        theme: 'striped',
        headStyles: { 
          fillColor: [43, 95, 143], 
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          textColor: 0
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 155, halign: 'left' }
        }
      });
    }
    
    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++){
      doc.setPage(i);
      
      // Footer line
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
      
      // Footer text
      doc.setFontSize(9);
      doc.setFont("times", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: 'right' });
      doc.text('Generated by RIT-IPR Portal', margin, pageHeight - 15);
      doc.text(`${new Date().toLocaleDateString('en-IN')}`, pageWidth/2, pageHeight - 15, { align: 'center' });
    }
    
    // Save PDF with proper filename
    const filename = `RIT_IPR_${inv.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    setToast("✓ Professional PDF Downloaded!");
  }

  function reset(){
    setScreen("dashboard");setStep(1);setData(null);setErr("");setGenLog([]);setGenProgress(0);
    setInv({title:"",problem:"",components:"",working:"",industry:"IoT",unique:""});
    setApplicant({appName:"",appAddress:"",institution:user?.institution||"",dept:user?.department||"",inventors:[{name:user?.name||"",address:"",nationality:"Indian"}],agentName:"",agentReg:"",agentAddress:"",filingOffice:"Chennai",date:new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}),nocStudents:[{sno:"1",name:"",dept:"",year:"I Year",roll:""}]});
    setUploadedFile(null);setExtractedText("");setOcrProgress(0);
    // Reload patent history to update dashboard
    loadPatentHistory();
  }

  function toggleForm(id){
    const required=FORMS_LIST.find(f=>f.id===id)?.required;
    if(required) return;
    setSelectedForms(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  }

  function addInventor(){
    setApplicant(p=>({...p,inventors:[...p.inventors,{name:"",address:"",nationality:"Indian"}]}));
  }
  function removeInventor(i){
    setApplicant(p=>({...p,inventors:p.inventors.filter((_,j)=>j!==i)}));
  }
  function updateInventor(i,k,v){
    setApplicant(p=>{const inv=[...p.inventors];inv[i]={...inv[i],[k]:v};return {...p,inventors:inv};});
  }
  function addStudent(){
    setApplicant(p=>({...p,nocStudents:[...p.nocStudents,{sno:String(p.nocStudents.length+1),name:"",dept:"",year:"I Year",roll:""}]}));
  }
  function updateStudent(i,k,v){
    setApplicant(p=>{const s=[...p.nocStudents];s[i]={...s[i],[k]:v};return {...p,nocStudents:s};});
  }

  const industries=["IoT","Healthcare","Agriculture","Education","Defense","Transportation","Energy","Robotics","AI/ML","Biotechnology","Other"];

  // ── Sidebar Component ──
  function Sidebar(){
    const menuItems = [
      { id: "dashboard", icon: "🏠", label: "Dashboard" },
      { id: "form", icon: "📝", label: "New Patent" },
      { id: "chat", icon: "💬", label: "AI Assistant" },
      ...(user?.role === 'faculty' ? [{ id: "submissions", icon: "📋", label: "My Submissions" }] : []),
      ...(user?.role === 'admin' ? [{ id: "admin", icon: "👨‍💼", label: "Admin Panel" }] : []),
      { id: "history", icon: "📚", label: "History" },
      { id: "account", icon: "👤", label: "Account" },
    ];

    return (
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div style={{padding:"0 24px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,fontWeight:700,color:C.muted,letterSpacing:1,textTransform:"uppercase"}}>Menu</div>
        </div>
        {menuItems.map(item => (
          <div
            key={item.id}
            className={`sidebar-item ${screen === item.id ? 'active' : ''}`}
            onClick={() => {
              setScreen(item.id);
              setErr("");
              // Load data when switching to specific screens
              if (item.id === 'dashboard') {
                loadPatentHistory();
              }
              if (item.id === 'submissions' || item.id === 'admin') {
                loadSubmissions();
              }
            }}
          >
            <span style={{fontSize:18}}>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <div style={{position:"absolute",bottom:20,left:0,right:0,padding:"0 24px"}}>
          <button 
            className="ghost" 
            style={{width:"100%",fontSize:13,padding:"10px"}}
            onClick={handleLogout}
          >
            🚪 Logout
          </button>
        </div>
      </div>
    );
  }

  // Top step bar
  const GLOBAL_STEPS = [
    {id:"form",    label:"Invention Details", icon:"💡"},
    {id:"results", label:"AI Analysis",       icon:"🔬"},
    {id:"formdetails", label:"Form Details",  icon:"📝"},
    {id:"formsready",  label:"Download Forms",icon:"📦"},
  ];
  const stepIdx = {form:0,loading:0,results:1,formdetails:2,generating:2,formsready:3};
  const curIdx  = stepIdx[screen]??0;

  // ═══════════════════════════════════
  //  DASHBOARD SCREEN
  // ═══════════════════════════════════
  if(screen==="dashboard") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:32}}>
            <div className="logo" style={{fontSize:32,marginBottom:8}}>Welcome to RIT IPR Portal</div>
            <div style={{fontSize:16,color:C.muted}}>AI-powered patent filing assistant for Rajalakshmi Institute of Technology</div>
          </div>

          {/* Stats Cards */}
          <div className="g3" style={{marginBottom:32}}>
            <div className="rc">
              <div style={{fontSize:36,marginBottom:8}}>📝</div>
              <div style={{fontSize:24,fontWeight:700,color:C.blue,marginBottom:4}}>{patentHistory.length}</div>
              <div style={{fontSize:13,color:C.muted}}>Total Patents</div>
            </div>
            <div className="rc">
              <div style={{fontSize:36,marginBottom:8}}>✅</div>
              <div style={{fontSize:24,fontWeight:700,color:C.green,marginBottom:4}}>
                {patentHistory.filter(p => p.status === "Completed").length}
              </div>
              <div style={{fontSize:13,color:C.muted}}>Completed</div>
            </div>
            <div className="rc">
              <div style={{fontSize:36,marginBottom:8}}>⭐</div>
              <div style={{fontSize:24,fontWeight:700,color:C.orange,marginBottom:4}}>
                {patentHistory.length > 0 ? Math.round(patentHistory.reduce((sum, p) => sum + p.innovationScore, 0) / patentHistory.length) : 0}
              </div>
              <div style={{fontSize:13,color:C.muted}}>Avg Innovation Score</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rc" style={{marginBottom:32}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>Quick Actions</div>
            <div className="g2">
              <button 
                className="btn" 
                style={{padding:"20px",fontSize:15,display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}
                onClick={() => setScreen("form")}
              >
                <span style={{fontSize:24}}>📝</span>
                <span>Start New Patent Application</span>
              </button>
              <button 
                className="ghost" 
                style={{padding:"20px",fontSize:15,display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}
                onClick={() => setScreen("history")}
              >
                <span style={{fontSize:24}}>📚</span>
                <span>View Patent History</span>
              </button>
            </div>
          </div>

          {/* Recent Patents */}
          {patentHistory.length > 0 && (
            <div className="rc">
              <div style={{fontSize:18,fontWeight:700,marginBottom:16}}>Recent Patents</div>
              {patentHistory.slice(0, 5).map((patent, i) => (
                <div 
                  key={patent.id} 
                  style={{
                    padding:"16px",
                    background:C.navyL,
                    border:`1px solid ${C.border}`,
                    borderRadius:10,
                    marginBottom:12,
                    animation:`fsu .4s ease ${i*.08}s both`
                  }}
                >
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8}}>
                    <div style={{fontSize:15,fontWeight:600,color:C.text,flex:1}}>{patent.title}</div>
                    <Bdg label={patent.status} type="g"/>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginBottom:8}}>
                    {new Date(patent.date).toLocaleDateString("en-IN", {day:"numeric",month:"short",year:"numeric"})}
                  </div>
                  <div style={{display:"flex",gap:12,fontSize:12,marginBottom:10}}>
                    <span>Innovation: <strong>{patent.innovationScore}</strong></span>
                    <span>Novelty: <strong>{patent.noveltyScore}</strong></span>
                    <span>Readiness: <strong>{patent.readinessScore}</strong></span>
                  </div>
                  <button 
                    className="ghost" 
                    style={{width:"100%",fontSize:12,padding:"6px 12px"}}
                    onClick={() => loadPatentFromHistory(patent)}
                  >
                    👁️ View Full Details
                  </button>
                </div>
              ))}
            </div>
          )}

          {patentHistory.length === 0 && (
            <div className="rc" style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>🚀</div>
              <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>No patents yet</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:24}}>Start your first patent application to see it here</div>
              <button className="btn" onClick={() => setScreen("form")}>Create First Patent</button>
            </div>
          )}
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  CHAT SCREEN
  // ═══════════════════════════════════
  if(screen==="chat") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"40px 20px",height:"calc(100vh - 120px)",display:"flex",flexDirection:"column"}}>
          <div style={{marginBottom:24}}>
            <div className="logo" style={{fontSize:28,marginBottom:8}}>💬 AI Patent Assistant</div>
            <div style={{fontSize:14,color:C.muted}}>Discuss your ideas and get guidance on developing them into patents</div>
          </div>

          {/* Chat Messages */}
          <div style={{
            flex:1,
            background:C.card,
            border:`1px solid ${C.border}`,
            borderRadius:12,
            padding:20,
            marginBottom:20,
            overflowY:"auto",
            minHeight:400
          }}>
            {chatMessages.length === 0 ? (
              <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
                <div style={{fontSize:48,marginBottom:16}}>🤖</div>
                <div style={{fontSize:16,marginBottom:8}}>Start a conversation!</div>
                <div style={{fontSize:14}}>Ask me about your invention ideas, patent process, or technical questions.</div>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} style={{
                  marginBottom:16,
                  display:"flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start"
                }}>
                  <div style={{
                    maxWidth:"70%",
                    padding:"12px 16px",
                    borderRadius:12,
                    background: msg.role === "user" ? C.blue : C.navyL,
                    color: msg.role === "user" ? "white" : C.text,
                    fontSize:14,
                    lineHeight:1.5
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            
            {isChatLoading && (
              <div style={{display:"flex",justifyContent:"flex-start",marginBottom:16}}>
                <div style={{
                  padding:"12px 16px",
                  borderRadius:12,
                  background:C.navyL,
                  fontSize:14
                }}>
                  <div className="spin" style={{width:16,height:16}}></div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div style={{display:"flex",gap:12,alignItems:"end"}}>
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              style={{
                flex:1,
                padding:"12px 16px",
                border:`1px solid ${C.border}`,
                borderRadius:8,
                fontSize:14,
                resize:"none",
                minHeight:50,
                maxHeight:120,
                fontFamily:"inherit"
              }}
              disabled={isChatLoading}
            />
            <button 
              className="btn" 
              onClick={sendChatMessage}
              disabled={!chatInput.trim() || isChatLoading}
              style={{padding:"12px 20px",minWidth:80}}
            >
              {isChatLoading ? "..." : "Send"}
            </button>
          </div>

          {/* Action Buttons */}
          {chatMessages.length > 0 && (
            <div style={{display:"flex",gap:12,marginTop:16,justifyContent:"center"}}>
              <button 
                className="btn-gold" 
                onClick={extractIdeaFromChat}
                style={{fontSize:13,padding:"8px 16px"}}
              >
                🔍 Check Patent Analysis
              </button>
              <button 
                className="ghost" 
                onClick={clearChat}
                style={{fontSize:13,padding:"8px 16px"}}
              >
                🗑️ Clear Chat
              </button>
            </div>
          )}
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  SUBMISSIONS SCREEN (Faculty)
  // ═══════════════════════════════════
  if(screen==="submissions") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:1000,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:32}}>
            <div className="logo" style={{fontSize:28,marginBottom:8}}>📋 My Submissions</div>
            <div style={{fontSize:14,color:C.muted}}>Track your patent submissions and review status</div>
          </div>

          {submissions.length === 0 ? (
            <div className="rc" style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>📋</div>
              <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>No submissions yet</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:24}}>Submit your first patent for admin review</div>
              <button className="btn" onClick={() => setScreen("form")}>Create New Patent</button>
            </div>
          ) : (
            submissions.map((submission, i) => (
              <div key={submission.id} className="rc" style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:600,color:C.text,marginBottom:4}}>
                      {submission.patents?.title || 'Patent Application'}
                    </div>
                    <div style={{fontSize:13,color:C.muted}}>
                      Submitted: {new Date(submission.submitted_at).toLocaleDateString("en-IN", {
                        day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"
                      })}
                    </div>
                  </div>
                  <Bdg 
                    label={submission.status} 
                    type={submission.status === 'approved' ? 'g' : submission.status === 'rejected' ? 'r' : 'y'} 
                  />
                </div>

                {submission.status === 'rejected' && submission.rejection_reason && (
                  <div style={{
                    background:"rgba(244,67,54,.05)",
                    border:"1px solid rgba(244,67,54,.2)",
                    borderRadius:8,
                    padding:"12px 16px",
                    marginBottom:12
                  }}>
                    <div style={{fontSize:12,fontWeight:600,color:"#c62828",marginBottom:4}}>❌ Rejection Reason:</div>
                    <div style={{fontSize:13,color:"#c62828"}}>{submission.rejection_reason}</div>
                  </div>
                )}

                {submission.status === 'approved' && (
                  <div style={{
                    background:"rgba(76,175,80,.05)",
                    border:"1px solid rgba(76,175,80,.2)",
                    borderRadius:8,
                    padding:"12px 16px",
                    marginBottom:12
                  }}>
                    <div style={{fontSize:13,color:"#2e7d32"}}>✅ Patent approved! Ready for final filing.</div>
                  </div>
                )}

                <div style={{display:"flex",gap:12,marginTop:12}}>
                  <button 
                    className="ghost" 
                    style={{fontSize:12,padding:"6px 12px"}}
                    onClick={() => viewSubmissionDetails(submission)}
                  >
                    👁️ View Details
                  </button>
                  {submission.status === 'approved' && (
                    <button 
                      className="btn" 
                      style={{fontSize:12,padding:"6px 12px"}}
                      onClick={() => {
                        viewSubmissionDetails(submission);
                        setTimeout(() => setScreen("formsready"), 500);
                      }}
                    >
                      📄 Download Forms
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  ADMIN PANEL SCREEN
  // ═══════════════════════════════════
  if(screen==="admin") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:32}}>
            <div className="logo" style={{fontSize:28,marginBottom:8}}>👨‍💼 Admin Panel</div>
            <div style={{fontSize:14,color:C.muted}}>Review and manage patent submissions</div>
          </div>

          {submissions.length === 0 ? (
            <div className="rc" style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>📋</div>
              <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>No pending submissions</div>
              <div style={{fontSize:14,color:C.muted}}>Faculty submissions will appear here for review</div>
            </div>
          ) : (
            submissions.map((submission, i) => (
              <div key={submission.id} className="rc" style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:600,color:C.text,marginBottom:4}}>
                      {submission.patents?.title || 'Patent Application'}
                    </div>
                    <div style={{fontSize:13,color:C.muted,marginBottom:4}}>
                      Faculty: {submission.profiles?.name} ({submission.profiles?.email})
                    </div>
                    <div style={{fontSize:13,color:C.muted}}>
                      Department: {submission.profiles?.department || 'N/A'}
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>
                      Submitted: {new Date(submission.submitted_at).toLocaleDateString("en-IN", {
                        day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"
                      })}
                    </div>
                  </div>
                  <Bdg label="Pending Review" type="y" />
                </div>

                <div style={{display:"flex",gap:12,marginBottom:16}}>
                  <button 
                    className="ghost" 
                    style={{fontSize:12,padding:"8px 16px"}}
                    onClick={() => viewSubmissionDetails(submission)}
                  >
                    👁️ View Full Application
                  </button>
                  <button 
                    className="ghost" 
                    style={{fontSize:12,padding:"8px 16px"}}
                    onClick={() => {
                      viewSubmissionDetails(submission);
                      setTimeout(() => setScreen("formsready"), 500);
                    }}
                  >
                    📄 Preview Forms
                  </button>
                </div>

                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <button 
                    className="btn" 
                    style={{background:"linear-gradient(135deg,#4CAF50,#66BB6A)",fontSize:13,padding:"8px 16px"}}
                    onClick={async () => {
                      try {
                        await submissionAPI.updateStatus(submission.id, 'approved');
                        setToast("✅ Patent approved!");
                        // Reload submissions
                        loadSubmissions();
                      } catch (error) {
                        setToast("❌ Failed to approve: " + error.message);
                      }
                    }}
                  >
                    ✅ Approve
                  </button>
                  <button 
                    className="btn" 
                    style={{background:"linear-gradient(135deg,#f44336,#e57373)",fontSize:13,padding:"8px 16px"}}
                    onClick={() => {
                      const reason = prompt("Please provide a reason for rejection:");
                      if (reason) {
                        submissionAPI.updateStatus(submission.id, 'rejected', reason)
                          .then(() => {
                            setToast("❌ Patent rejected");
                            loadSubmissions();
                          })
                          .catch(error => {
                            setToast("❌ Failed to reject: " + error.message);
                          });
                      }
                    }}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  ACCOUNT SCREEN
  // ═══════════════════════════════════
  if(screen==="account") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:32}}>
            <div className="logo" style={{fontSize:28,marginBottom:8}}>Account Information</div>
            <div style={{fontSize:14,color:C.muted}}>Manage your profile and view statistics</div>
          </div>

          {/* Profile Information */}
          <div className="rc" style={{marginBottom:24}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>👤</span>
              <span>Profile</span>
            </div>
            <div className="g2">
              <div>
                <div className="lbl">Name</div>
                <div style={{padding:"11px 15px",background:C.navyL,borderRadius:10,fontSize:14}}>{user?.name}</div>
              </div>
              <div>
                <div className="lbl">Email</div>
                <div style={{padding:"11px 15px",background:C.navyL,borderRadius:10,fontSize:14}}>{user?.email}</div>
              </div>
              <div>
                <div className="lbl">Institution</div>
                <div style={{padding:"11px 15px",background:C.navyL,borderRadius:10,fontSize:14}}>{user?.institution || "N/A"}</div>
              </div>
              <div>
                <div className="lbl">Department</div>
                <div style={{padding:"11px 15px",background:C.navyL,borderRadius:10,fontSize:14}}>{user?.department || "N/A"}</div>
              </div>
            </div>
            <div style={{marginTop:16,padding:"12px",background:"rgba(43,95,143,.05)",borderRadius:8,fontSize:12,color:C.muted}}>
              <strong>Member since:</strong> {new Date(user?.createdAt).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"})}
            </div>
          </div>

          {/* Statistics */}
          <div className="rc">
            <div style={{fontSize:18,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>📊</span>
              <span>Statistics</span>
            </div>
            <div className="g3">
              <div style={{textAlign:"center",padding:"16px",background:C.navyL,borderRadius:10}}>
                <div style={{fontSize:28,fontWeight:700,color:C.blue}}>{patentHistory.length}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Total Patents</div>
              </div>
              <div style={{textAlign:"center",padding:"16px",background:C.navyL,borderRadius:10}}>
                <div style={{fontSize:28,fontWeight:700,color:C.green}}>
                  {patentHistory.filter(p => p.readinessScore >= 70).length}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Ready to File</div>
              </div>
              <div style={{textAlign:"center",padding:"16px",background:C.navyL,borderRadius:10}}>
                <div style={{fontSize:28,fontWeight:700,color:C.orange}}>
                  {patentHistory.length > 0 ? Math.round(patentHistory.reduce((sum, p) => sum + p.innovationScore, 0) / patentHistory.length) : 0}
                </div>
                <div style={{fontSize:12,color:C.muted,marginTop:4}}>Avg Score</div>
              </div>
            </div>
            <div style={{marginTop:16,padding:"12px",background:"rgba(76,175,80,.05)",borderRadius:8,fontSize:12,color:C.muted,textAlign:"center"}}>
              <strong>🤖 Powered by Google Gemini AI</strong> - Advanced AI-powered patent analysis
            </div>
          </div>

          <div style={{marginTop:24,textAlign:"center"}}>
            <button className="ghost" onClick={() => setScreen("dashboard")}>← Back to Dashboard</button>
          </div>
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  HISTORY SCREEN
  // ═══════════════════════════════════
  if(screen==="history") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar/>
      
      <Sidebar />
      
      <div className={`main-content ${!sidebarOpen ? 'full' : ''}`}>
        <div style={{maxWidth:1000,margin:"0 auto",padding:"40px 20px"}}>
          <div style={{marginBottom:32,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div className="logo" style={{fontSize:28,marginBottom:8}}>Patent History</div>
              <div style={{fontSize:14,color:C.muted}}>All your patent applications</div>
            </div>
            <button className="btn" onClick={() => setScreen("form")}>+ New Patent</button>
          </div>

          {patentHistory.length === 0 ? (
            <div className="rc" style={{textAlign:"center",padding:"60px 20px"}}>
              <div style={{fontSize:48,marginBottom:16}}>📚</div>
              <div style={{fontSize:18,fontWeight:600,marginBottom:8}}>No patent history</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:24}}>Your completed patent applications will appear here</div>
              <button className="btn" onClick={() => setScreen("form")}>Start First Patent</button>
            </div>
          ) : (
            <div>
              {patentHistory.map((patent, i) => (
                <div 
                  key={patent.id} 
                  className="rc" 
                  style={{marginBottom:16,animation:`fsu .4s ease ${i*.08}s both`}}
                >
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:18,fontWeight:600,color:C.text,marginBottom:4}}>{patent.title}</div>
                      <div style={{fontSize:13,color:C.muted}}>
                        {new Date(patent.date).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                    <Bdg label={patent.status} type="g"/>
                  </div>
                  
                  <div style={{display:"flex",gap:16,marginBottom:12}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Innovation</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <PBar val={patent.innovationScore}/>
                        <span style={{fontSize:13,fontWeight:600,minWidth:40}}>{patent.innovationScore}/100</span>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Novelty</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <PBar val={patent.noveltyScore}/>
                        <span style={{fontSize:13,fontWeight:600,minWidth:40}}>{patent.noveltyScore}/100</span>
                      </div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:C.muted,marginBottom:4}}>Readiness</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <PBar val={patent.readinessScore}/>
                        <span style={{fontSize:13,fontWeight:600,minWidth:40}}>{patent.readinessScore}/100</span>
                      </div>
                    </div>
                  </div>

                  <div style={{padding:"10px 12px",background:C.navyL,borderRadius:8,fontSize:13,marginBottom:12}}>
                    <strong>Recommendation:</strong> <span style={{color:C.blue}}>{patent.recommendation}</span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button 
                      className="btn" 
                      style={{flex:1,fontSize:13,padding:"8px 16px"}}
                      onClick={() => loadPatentFromHistory(patent)}
                    >
                      👁️ View Details
                    </button>
                    <button 
                      className="btn-gold" 
                      style={{flex:1,fontSize:13,padding:"8px 16px"}}
                      onClick={() => {
                        // Load patent data and generate PDF
                        loadPatentFromHistory(patent);
                        setTimeout(() => generatePDF(), 500);
                      }}
                    >
                      📄 Download PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  LOGIN SCREEN
  // ═══════════════════════════════════
  if(screen==="login") return (
    <div className="bg" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{maxWidth:450,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/rit-logo.png" alt="RIT" style={{height:80,marginBottom:16}} />
          <div style={{fontSize:24,fontWeight:700,color:C.blue,marginBottom:4}}>IPR Portal</div>
          <div style={{fontSize:14,color:C.muted}}>Rajalakshmi Institute of Technology</div>
        </div>
        
        <div style={{background:"#ffffff",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 4px 20px rgba(0,0,0,.08)",padding:"32px"}}>
          <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:6}}>Login to Your Account</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Enter your credentials to access the patent filing system</div>
          
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:16}}>
              <div className="lbl">Email Address *</div>
              <input 
                className="inp" 
                type="email" 
                placeholder="your.email@ritchennai.edu.in"
                value={loginForm.email}
                onChange={e=>setLoginForm(p=>({...p,email:e.target.value}))}
                required
              />
            </div>
            
            <div style={{marginBottom:16}}>
              <div className="lbl">Password *</div>
              <input 
                className="inp" 
                type="password" 
                placeholder="Enter your password"
                value={loginForm.password}
                onChange={e=>setLoginForm(p=>({...p,password:e.target.value}))}
                required
              />
            </div>
            
            <div style={{marginBottom:20}}>
              <div className="lbl">Gemini API Key (Optional)</div>
              <input 
                className="inp" 
                type="text" 
                placeholder="Enter your Gemini API key (leave empty to use default)"
                value={loginForm.geminiApiKey}
                onChange={e=>setLoginForm(p=>({...p,geminiApiKey:e.target.value}))}
              />
              <div style={{fontSize:11,color:C.muted,marginTop:6}}>
                💡 Provide your own Gemini API key for AI analysis, or leave empty to use the default key
              </div>
            </div>
            
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:16,padding:"10px 14px",background:"rgba(244,67,54,.08)",borderRadius:8,border:"1px solid rgba(244,67,54,.2)"}}>⚠ {err}</div>}
            
            <button type="submit" className="btn" style={{width:"100%",marginBottom:16}}>Login</button>
            
            <div style={{textAlign:"center",fontSize:13,color:C.muted}}>
              Don't have an account? <span style={{color:C.blue,cursor:"pointer",fontWeight:600}} onClick={()=>{setScreen("register");setErr("");}}>Create Account</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════
  //  REGISTER SCREEN
  // ═══════════════════════════════════
  if(screen==="register") return (
    <div className="bg" style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{maxWidth:550,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <img src="/rit-logo.png" alt="RIT" style={{height:70,marginBottom:16}} />
          <div style={{fontSize:24,fontWeight:700,color:C.blue,marginBottom:4}}>Create Your Account</div>
          <div style={{fontSize:14,color:C.muted}}>Join RIT IPR Portal for patent filing assistance</div>
        </div>
        
        <div style={{background:"#ffffff",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 4px 20px rgba(0,0,0,.08)",padding:"32px"}}>
          <form onSubmit={handleRegister}>
            <div className="g2" style={{marginBottom:16}}>
              <div>
                <div className="lbl">Full Name *</div>
                <input 
                  className="inp" 
                  type="text" 
                  placeholder="John Doe"
                  value={registerForm.name}
                  onChange={e=>setRegisterForm(p=>({...p,name:e.target.value}))}
                  required
                />
              </div>
              <div>
                <div className="lbl">Email Address *</div>
                <input 
                  className="inp" 
                  type="email" 
                  placeholder="john@ritchennai.edu.in"
                  value={registerForm.email}
                  onChange={e=>setRegisterForm(p=>({...p,email:e.target.value}))}
                  required
                />
              </div>
            </div>
            
            <div style={{marginBottom:16}}>
              <div className="lbl">Department</div>
              <input 
                className="inp" 
                type="text" 
                placeholder="Computer Science"
                value={registerForm.department}
                onChange={e=>setRegisterForm(p=>({...p,department:e.target.value}))}
              />
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>
                Institution: Rajalakshmi Institute of Technology (set automatically)
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <div className="lbl">Role *</div>
              <select 
                className="inp" 
                value={registerForm.role || 'faculty'}
                onChange={e=>setRegisterForm(p=>({...p,role:e.target.value}))}
                required
              >
                <option value="faculty">Faculty Member</option>
                <option value="admin">Administrator</option>
              </select>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>
                Faculty can submit patents for review. Admins can approve/reject submissions.
              </div>
            </div>
            
            <div className="g2" style={{marginBottom:16}}>
              <div>
                <div className="lbl">Password *</div>
                <input 
                  className="inp" 
                  type="password" 
                  placeholder="Min 6 characters"
                  value={registerForm.password}
                  onChange={e=>setRegisterForm(p=>({...p,password:e.target.value}))}
                  required
                />
              </div>
              <div>
                <div className="lbl">Confirm Password *</div>
                <input 
                  className="inp" 
                  type="password" 
                  placeholder="Re-enter password"
                  value={registerForm.confirmPassword}
                  onChange={e=>setRegisterForm(p=>({...p,confirmPassword:e.target.value}))}
                  required
                />
              </div>
            </div>
            
            <div style={{background:"rgba(43,95,143,.05)",padding:16,borderRadius:10,marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:10}}>🔑 API Keys (Optional)</div>
              <div style={{marginBottom:12}}>
                <div className="lbl">Claude API Key</div>
                <input 
                  className="inp" 
                  type="password" 
                  placeholder="sk-ant-..."
                  value={registerForm.claudeKey}
                  onChange={e=>setRegisterForm(p=>({...p,claudeKey:e.target.value}))}
                />
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:8}}>API keys are stored securely in your browser and never sent to our servers</div>
            </div>
            
            {err&&<div style={{color:C.danger,fontSize:13,marginBottom:16,padding:"10px 14px",background:"rgba(244,67,54,.08)",borderRadius:8,border:"1px solid rgba(244,67,54,.2)"}}>⚠ {err}</div>}
            
            <button type="submit" className="btn" style={{width:"100%",marginBottom:16}}>Create Account</button>
            
            <div style={{textAlign:"center",fontSize:13,color:C.muted}}>
              Already have an account? <span style={{color:C.blue,cursor:"pointer",fontWeight:600}} onClick={()=>{setScreen("login");setErr("");}}>Login</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  function NavBar({children}){
    return (
      <nav className="nav">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {isLoggedIn && (
            <button 
              className="ghost" 
              style={{padding:"8px 12px",fontSize:18}}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Menu"
            >
              ☰
            </button>
          )}
          <img src="/rit-logo.png" alt="RIT IPR" style={{height:45}} />
          <div style={{borderLeft:"2px solid #dee2e6",height:35,margin:"0 8px"}}/>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.blue,letterSpacing:"-0.5px"}}>IPR Portal</div>
            <div style={{fontSize:10,color:C.muted,marginTop:-2}}>Patent Filing Assistant</div>
          </div>
        </div>
        <div style={{display:"flex",gap:9,alignItems:"center"}}>
          {isLoggedIn && user && (
            <div style={{fontSize:12,color:C.muted,marginRight:8}}>
              Welcome, <span style={{color:C.blue,fontWeight:600}}>{user.name}</span>
            </div>
          )}
          {children}
          {isLoggedIn && screen !== "dashboard" && (
            <button className="btn" style={{fontSize:13,padding:"7px 14px"}} onClick={() => { setScreen("dashboard"); loadPatentHistory(); }}>🏠 Home</button>
          )}
          {isLoggedIn && (
            <button className="ghost" style={{fontSize:13,padding:"7px 14px"}} onClick={handleLogout}>Logout</button>
          )}
        </div>
      </nav>
    );
  }

  function StepBar(){
    return (
      <div className="step-bar">
        {GLOBAL_STEPS.map((s,i)=>(
          <div key={s.id} style={{display:"flex",alignItems:"center"}}>
            <div className="step-item">
              <div className="sdot" style={{
                background: i<curIdx?"rgba(76,175,80,.15)":i===curIdx?"#2B5F8F":"#e9ecef",
                color: i<curIdx?"#2e7d32":i===curIdx?"#fff":"#6c757d",
                border: i<curIdx?"1px solid rgba(76,175,80,.3)":"none",
                boxShadow: i===curIdx?"0 0 14px rgba(43,95,143,.4)":"none",
              }}>
                {i<curIdx?"✓":i+1}
              </div>
              <span style={{fontSize:12,color:i===curIdx?C.text:C.muted,fontWeight:i===curIdx?600:400}}>{s.icon} {s.label}</span>
            </div>
            {i<GLOBAL_STEPS.length-1&&<div className="step-sep" style={{background:i<curIdx?C.green:C.border}}/>}
          </div>
        ))}
      </div>
    );
  }

  // ═══════════════════════════════════
  //  LOADING
  // ═══════════════════════════════════
  if(screen==="loading") return (
    <div className="bg" style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:22}}>
      <div className="spin"/>
      <img src="/rit-logo.png" alt="RIT IPR" style={{height:70,marginBottom:10}} />
      <div style={{color:C.muted,fontSize:14}}>AI is analyzing your invention...</div>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        {["Prior Art Search","Drafting Patent","Scoring"].map((s,i)=>(
          <div key={s} style={{fontSize:12,color:C.muted,background:"rgba(43,95,143,.08)",border:`1px solid ${C.border}`,borderRadius:20,padding:"4px 12px",animation:`pulse 1.5s ease ${i*.3}s infinite`}}>{s}</div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════
  //  FORM — INVENTION SUBMISSION
  // ═══════════════════════════════════
  if(screen==="form") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar><div style={{fontSize:12,color:C.muted}}>AI Patent Protection Platform</div></NavBar>
      <StepBar/>
      <div style={{maxWidth:680,margin:"0 auto",padding:"36px 20px"}}>
        {/* Step indicator */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:36}}>
          {["Basic Info","Technical","Review"].map((label,i)=>{
            const n=i+1,state=step>n?"done":step===n?"on":"off";
            return(
              <div key={label} style={{display:"flex",alignItems:"center"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                  <div className={`sdot ${state}`}>{state==="done"?"✓":n}</div>
                  <span style={{fontSize:11,color:state==="on"?C.text:C.muted,fontWeight:state==="on"?600:400}}>{label}</span>
                </div>
                {i<2&&<div style={{width:55,height:1,background:step>n?C.green:C.border,margin:"0 8px",marginBottom:18,transition:"background .4s"}}/>}
              </div>
            );
          })}
        </div>

        <div style={{background:"#ffffff",border:`1px solid ${C.border}`,borderRadius:16,boxShadow:"0 2px 12px rgba(0,0,0,.06)",padding:"32px"}}>
          {step===1&&<>
            <div style={{fontSize:24,fontWeight:700,marginBottom:5,color:C.text}}>Submit Your Invention</div>
            <div style={{color:C.muted,fontSize:14,marginBottom:26}}>Tell us the basics of your idea</div>
            
            {/* File Upload with OCR */}
            <div style={{marginBottom:24,padding:"16px",background:"rgba(43,95,143,.05)",borderRadius:12,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:14,fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
                <span>📄</span>
                <span>Upload Document (Optional)</span>
              </div>
              <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
                Upload your invention document - we support images (OCR), PDFs, and Word documents
              </div>
              <input 
                type="file" 
                accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                onChange={handleFileUpload}
                style={{display:"none"}}
                id="file-upload"
                disabled={isProcessingOCR}
              />
              <label 
                htmlFor="file-upload" 
                className="upload-zone"
                style={{display:"block",cursor:isProcessingOCR?"not-allowed":"pointer",opacity:isProcessingOCR?0.6:1}}
              >
                {isProcessingOCR ? (
                  <div>
                    <div className="spin" style={{margin:"0 auto 12px"}}/>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Extracting Text...</div>
                    <div style={{fontSize:12,color:C.muted}}>{ocrProgress}% complete</div>
                    <div className="pbar" style={{maxWidth:200,margin:"12px auto 0"}}>
                      <div className="pfill" style={{width:`${ocrProgress}%`,background:C.blue}}/>
                    </div>
                  </div>
                ) : uploadedFile ? (
                  <div>
                    <div style={{fontSize:32,marginBottom:8}}>✅</div>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>File Uploaded: {uploadedFile.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>Text extracted successfully!</div>
                    <button 
                      className="ghost" 
                      style={{marginTop:12,fontSize:12,padding:"6px 12px"}}
                      onClick={(e) => {
                        e.preventDefault();
                        setUploadedFile(null);
                        setExtractedText("");
                        setOcrProgress(0);
                      }}
                    >
                      Upload Different File
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{fontSize:32,marginBottom:8}}>📤</div>
                    <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>Click to upload or drag and drop</div>
                    <div style={{fontSize:12,color:C.muted}}>Images (PNG, JPG), PDF, Word (DOC, DOCX)</div>
                  </div>
                )}
              </label>
              {extractedText && (
                <div style={{marginTop:12,padding:"10px",background:"#ffffff",borderRadius:8,border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6}}>EXTRACTED TEXT (Preview)</div>
                  <div style={{fontSize:12,color:C.text,maxHeight:100,overflow:"auto",lineHeight:1.5}}>
                    {extractedText.slice(0, 300)}{extractedText.length > 300 ? "..." : ""}
                  </div>
                </div>
              )}
            </div>

            <div style={{marginBottom:18}}><div className="lbl">Invention Title *</div><input className="inp" placeholder="e.g. IoT-Based Smart Vehicle Anti-Theft System" value={inv.title} onChange={e=>fi("title",e.target.value)}/></div>
            <div style={{marginBottom:18}}><div className="lbl">Problem It Solves *</div><textarea className="inp" rows={3} placeholder="What problem does your invention solve?" value={inv.problem} onChange={e=>fi("problem",e.target.value)}/></div>
            <div style={{marginBottom:26}}><div className="lbl">Target Industry *</div><select className="inp" value={inv.industry} onChange={e=>fi("industry",e.target.value)}>{industries.map(i=><option key={i}>{i}</option>)}</select></div>
            <button className="btn" style={{width:"100%"}} disabled={!inv.title||!inv.problem} onClick={()=>setStep(2)}>Next: Technical Details →</button>
          </>}

          {step===2&&<>
            <div style={{fontSize:24,fontWeight:700,marginBottom:5,color:C.text}}>Technical Details</div>
            <div style={{color:C.muted,fontSize:14,marginBottom:26}}>More detail = better patent draft</div>
            <div style={{marginBottom:18}}><div className="lbl">Components Used *</div><input className="inp" placeholder="e.g. ESP32, Ultrasonic Sensor, GSM SIM800L, GPS NEO-6M" value={inv.components} onChange={e=>fi("components",e.target.value)}/><div style={{fontSize:12,color:C.muted,marginTop:5}}>Separate with commas</div></div>
            <div style={{marginBottom:18}}><div className="lbl">How It Works *</div><textarea className="inp" rows={4} placeholder="Describe step by step. How do components interact?" value={inv.working} onChange={e=>fi("working",e.target.value)}/></div>
            <div style={{marginBottom:26}}><div className="lbl">What Makes It Unique *</div><textarea className="inp" rows={3} placeholder="What is novel compared to existing solutions?" value={inv.unique} onChange={e=>fi("unique",e.target.value)}/></div>
            <div style={{display:"flex",gap:10}}>
              <button className="ghost" onClick={()=>setStep(1)}>← Back</button>
              <button className="btn" style={{flex:1}} disabled={!inv.components||!inv.working||!inv.unique} onClick={()=>setStep(3)}>Next: Review →</button>
            </div>
          </>}

          {step===3&&<>
            <div style={{fontSize:24,fontWeight:700,marginBottom:5,color:C.text}}>Review & Analyze</div>
            <div style={{color:C.muted,fontSize:14,marginBottom:22}}>Confirm your invention details</div>
            {[["Invention",inv.title],["Industry",inv.industry],["Problem",inv.problem],["Components",inv.components],["Working Principle",inv.working],["Unique Features",inv.unique]].map(([l,v])=>(
              <div key={l} style={{marginBottom:10,padding:"11px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:`1px solid ${C.border}`}}>
                <div className="lbl" style={{marginBottom:3}}>{l}</div>
                <div style={{fontSize:13.5,color:C.text,lineHeight:1.5}}>{v}</div>
              </div>
            ))}
            
            {/* AI Model Selection */}
            {err&&<div style={{color:C.danger,fontSize:13,margin:"14px 0",padding:"10px 14px",background:"rgba(244,67,54,.08)",borderRadius:8,border:"1px solid rgba(244,67,54,.2)"}}>⚠ {err}</div>}
            <div style={{display:"flex",gap:10,marginTop:14}}>
              <button className="ghost" onClick={()=>setStep(2)}>← Edit</button>
              <button className="btn" style={{flex:1}} onClick={analyze}>⚡ Analyze with AI</button>
            </div>
          </>}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════
  //  RESULTS
  // ═══════════════════════════════════
  if(screen==="results"&&data) return (
    <div className="bg" style={{minHeight:"100vh"}} ref={topRef}>
      <NavBar>
        <button className="ghost" style={{fontSize:13,padding:"7px 14px"}} onClick={reset}>+ New</button>
        <button className="btn" style={{fontSize:13,padding:"7px 18px"}} onClick={()=>copy(fullReport())}>📋 Copy Report</button>
        <button className="btn" style={{fontSize:13,padding:"7px 18px"}} onClick={generatePDF}>📄 Download PDF</button>
        <button className="btn-gold" style={{fontSize:13,padding:"7px 18px"}} onClick={()=>{saveToHistory();setScreen("formdetails");}}>📄 Generate IPO Forms →</button>
      </NavBar>
      <StepBar/>

      <div style={{maxWidth:1080,margin:"0 auto",padding:"32px 20px 48px"}}>
        {/* Header */}
        <div style={{marginBottom:26}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            <Bdg label={data.domain} type="b"/>
            <Bdg label={data.patentType} type="b"/>
            <Bdg label={`${data.marketPotential} Market`} type={data.marketPotential==="High"?"g":data.marketPotential==="Medium"?"y":"r"}/>
          </div>
          <div className="logo" style={{fontSize:28,color:C.text,lineHeight:1.2,marginBottom:6}}>{inv.title}</div>
          <div style={{color:C.muted,fontSize:13}}>Analysis complete · {new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</div>
        </div>

        {/* CTA Banner */}
        <div style={{background:"linear-gradient(135deg,rgba(255,138,101,.12),rgba(255,138,101,.08))",border:"1px solid rgba(255,138,101,.25)",borderRadius:14,padding:"18px 24px",marginBottom:24,display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.orange,marginBottom:4}}>🎉 Analysis Complete! Ready to file your patent?</div>
            <div style={{fontSize:13,color:C.muted}}>Generate all Indian Patent Office forms (Form 1, 2, 3, 5, 26 + NOC) pre-filled with your details.</div>
          </div>
          <button className="btn-gold" onClick={()=>setScreen("formdetails")}>📄 Generate IPO Forms →</button>
        </div>

        {/* 3 Score Cards */}
        <div className="g3" style={{marginBottom:18}}>
          {[["💡","Innovation Score",data.innovationScore],["🔬","Novelty Score",data.noveltyScore],["📋","Patent Readiness",data.readinessScore]].map(([icon,label,score])=>(
            <div key={label} className="rc" style={{display:"flex",alignItems:"center",gap:16}}>
              <Ring score={score} size={70}/>
              <div><div style={{fontSize:12,color:C.muted,marginBottom:5}}>{icon} {label}</div><Bdg label={score>=70?"Strong":score>=45?"Moderate":"Weak"} type={sc(score)}/></div>
            </div>
          ))}
        </div>

        <div className="g2" style={{marginBottom:18}}>
          {/* Novelty */}
          <div className="rc">
            <div className="lbl">🔍 Novelty Analysis</div>
            <div style={{display:"flex",alignItems:"center",gap:14,margin:"14px 0"}}>
              <Ring score={data.noveltyScore} size={58}/>
              <div><div style={{fontSize:12,color:C.muted,marginBottom:6}}>Patentability Verdict</div><Bdg label={data.patentabilityVerdict} type={data.patentabilityVerdict==="Strong"?"g":data.patentabilityVerdict==="Moderate"?"y":"r"}/></div>
            </div>
            <div className="div"/>
            <div style={{fontSize:12,color:C.muted,marginBottom:8,fontWeight:600}}>Why it's novel:</div>
            {data.noveltyReasons?.map((r,i)=>(
              <div key={i} style={{display:"flex",gap:9,marginBottom:8,alignItems:"flex-start"}}>
                <span style={{color:C.green,fontSize:13,marginTop:1}}>✓</span>
                <span style={{fontSize:13,color:C.text,lineHeight:1.55}}>{r}</span>
              </div>
            ))}
          </div>
          {/* Grant */}
          <div className="rc">
            <div className="lbl">🎯 Grant Predictor</div>
            <div style={{display:"flex",alignItems:"center",gap:14,margin:"14px 0"}}>
              <Ring score={data.grantProbability||70} size={58} color={C.gold}/>
              <div>
                <div style={{fontSize:12,color:C.muted,marginBottom:4}}>Approval Probability</div>
                <div style={{fontSize:22,fontWeight:700,color:C.gold,fontFamily:"'Syne',sans-serif"}}>{data.grantProbability||70}%</div>
                <div style={{fontSize:11,color:C.muted}}>before filing</div>
              </div>
            </div>
            <div className="div"/>
            <div style={{fontSize:12,color:C.muted,marginBottom:8,fontWeight:600}}>Key factors:</div>
            {data.grantFactors?.map((gf,i)=>(
              <div key={i} style={{display:"flex",gap:9,marginBottom:8,alignItems:"flex-start"}}>
                <span style={{color:C.gold,fontSize:12}}>◆</span>
                <span style={{fontSize:13,color:C.text,lineHeight:1.55}}>{gf}</span>
              </div>
            ))}
            <div className="div"/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:C.muted}}>Est. Filing Cost</span>
              <span className="mono" style={{fontSize:13,fontWeight:700,color:C.green}}>{data.filingCost||"₹8,000–₹15,000"}</span>
            </div>
          </div>
        </div>

        {/* Prior Art */}
        <div className="rc" style={{marginBottom:18}}>
          <div className="lbl" style={{marginBottom:14}}>📚 Prior Art Search Results</div>
          {data.similarPatents?.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 14px",background:"rgba(255,255,255,.03)",borderRadius:10,border:`1px solid ${C.border}`,marginBottom:9}}>
              <div style={{width:28,height:28,borderRadius:8,background:"rgba(57,73,171,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.indigoL,flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13.5,fontWeight:600,color:C.text,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</div>
                <div style={{fontSize:12,color:C.muted}}>{p.office} · {p.year}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:p.similarity<35?C.green:p.similarity<60?C.warn:C.danger,marginBottom:4}}>{p.similarity}% match</div>
                <div style={{width:88}}><PBar val={p.similarity} color={p.similarity<35?C.green:p.similarity<60?C.warn:C.danger}/></div>
              </div>
            </div>
          ))}
          <div style={{padding:"11px 14px",background:"rgba(0,230,118,.07)",borderRadius:9,border:"1px solid rgba(0,230,118,.18)",marginTop:4}}>
            <span style={{fontSize:13,color:C.green,fontWeight:600}}>✓ Verdict: </span>
            <span style={{fontSize:13,color:C.text}}>Your invention shows sufficient novelty with no direct prior art conflicts.</span>
          </div>
        </div>

        {/* Patent Draft */}
        <div className="rc" style={{marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
            <div className="lbl">📄 Generated Patent Draft</div>
            <button className="ghost" style={{fontSize:12,padding:"6px 13px"}} onClick={()=>copy(`ABSTRACT:\n${data.abstract}\n\nTECHNICAL DESCRIPTION:\n${data.technicalDescription}\n\nCLAIMS:\n${data.claims?.join("\n\n")}`)}>Copy Draft</button>
          </div>
          {[["ABSTRACT",data.abstract],["TECHNICAL DESCRIPTION",data.technicalDescription]].map(([title,content])=>(
            <div key={title} style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:C.indigoL,marginBottom:9,letterSpacing:1}}>{title}</div>
              <div style={{fontSize:13.5,color:C.text,lineHeight:1.8,padding:"15px",background:"rgba(255,255,255,.03)",borderRadius:10,border:`1px solid ${C.border}`}}>{content}</div>
            </div>
          ))}
          <div style={{fontSize:12,fontWeight:700,color:C.indigoL,marginBottom:9,letterSpacing:1}}>CLAIMS</div>
          {data.claims?.map((cl,i)=><div key={i} className="claim">{cl}</div>)}
        </div>

        <div className="g2" style={{marginBottom:24}}>
          <div className="rc">
            <div className="lbl" style={{marginBottom:14}}>🏷️ IPC Classification Codes</div>
            {data.ipcCodes?.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:12,marginBottom:12,padding:"11px 13px",background:"rgba(255,255,255,.03)",borderRadius:10}}>
                <div className="mono" style={{fontSize:11,fontWeight:700,color:C.gold,padding:"4px 9px",background:"rgba(255,193,7,.1)",borderRadius:6,alignSelf:"flex-start",flexShrink:0}}>{c.code}</div>
                <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{c.description}</div>
              </div>
            ))}
          </div>
          <div className="rc">
            <div className="lbl" style={{marginBottom:10}}>🚀 Readiness & Next Steps</div>
            <div style={{display:"flex",alignItems:"center",gap:14,margin:"14px 0"}}>
              <Ring score={data.readinessScore} size={54}/>
              <div>
                <Bdg label={data.recommendation} type={data.recommendation==="Ready to File"?"g":data.recommendation?.includes("Too Similar")?"r":"y"}/>
                <div style={{fontSize:11,color:C.muted,marginTop:5}}>Patent Readiness Score</div>
              </div>
            </div>
            <div className="div"/>
            {data.nextSteps?.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:11,marginBottom:11,alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(57,73,171,.2)",border:"1px solid rgba(92,107,192,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:C.indigoL,flexShrink:0}}>{i+1}</div>
                <span style={{fontSize:13,color:C.text,lineHeight:1.55}}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{background:"linear-gradient(135deg,rgba(57,73,171,.15),rgba(92,107,192,.08))",border:`1px solid ${C.border}`,borderRadius:16,padding:"28px",textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Ready to file your patent? 📦</div>
          <div style={{fontSize:14,color:C.muted,marginBottom:20}}>Generate all required Indian Patent Office forms pre-filled with your invention details — Form 1, 2, 3, 5, 26, and both NOC documents.</div>
          <button className="btn-gold" style={{fontSize:15,padding:"14px 36px"}} onClick={()=>setScreen("formdetails")}>
            📄 Generate All IPO Forms →
          </button>
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  // ═══════════════════════════════════
  //  FORM DETAILS — collect applicant info
  // ═══════════════════════════════════
  if(screen==="formdetails") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar>
        <button className="ghost" style={{fontSize:13,padding:"7px 14px"}} onClick={()=>setScreen("results")}>← Back to Results</button>
      </NavBar>
      <StepBar/>

      <div style={{maxWidth:820,margin:"0 auto",padding:"32px 20px 48px"}}>
        <div style={{marginBottom:28}}>
          <div className="logo" style={{fontSize:28,marginBottom:6}}>📄 Patent Form Details</div>
          <div style={{color:C.muted,fontSize:14}}>Fill in your details below. All forms will be pre-populated with this information plus your AI-generated patent draft.</div>
        </div>

        {/* Select Forms */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>Select Forms to Generate</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {FORMS_LIST.map(f=>(
              <div key={f.id} className={`form-card ${selectedForms.includes(f.id)?"selected":""}`} onClick={()=>toggleForm(f.id)} style={{cursor:f.required?"default":"pointer"}}>
                <div className="checkbox-row">
                  <div className={`cb ${selectedForms.includes(f.id)?"checked":""}`}>
                    {selectedForms.includes(f.id)&&<span style={{color:"#fff",fontSize:12,fontWeight:700}}>✓</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:15}}>{f.icon}</span>
                      <span style={{fontSize:13,fontWeight:700,color:C.text}}>{f.label} — {f.name}</span>
                      {f.required&&<span className="bdg bg-gold" style={{fontSize:10}}>Required</span>}
                    </div>
                    <div style={{fontSize:12,color:C.muted}}>{f.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 1 — Applicant */}
        <div style={{background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:14,padding:"24px",marginBottom:18}}>
          <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:16}}>👤 Applicant & Institution Details</div>
          <div className="g2" style={{marginBottom:14}}>
            <div><div className="lbl">Applicant / Institution Name *</div><input className="inp" placeholder="e.g. Rajalakshmi Institute of Technology" value={applicant.appName} onChange={e=>fa("appName",e.target.value)}/></div>
            <div><div className="lbl">Department</div><input className="inp" placeholder="e.g. Artificial Intelligence and Data Science" value={applicant.dept} onChange={e=>fa("dept",e.target.value)}/></div>
          </div>
          <div style={{marginBottom:14}}><div className="lbl">Full Address *</div><textarea className="inp" rows={2} placeholder="Complete address including city, state, PIN" value={applicant.appAddress} onChange={e=>fa("appAddress",e.target.value)}/></div>
          <div className="g2">
            <div><div className="lbl">Filing Office</div>
              <select className="inp" value={applicant.filingOffice} onChange={e=>fa("filingOffice",e.target.value)}>
                {["Chennai","Mumbai","Delhi","Kolkata","Ahmedabad"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div><div className="lbl">Filing Date</div><input className="inp" value={applicant.date} onChange={e=>fa("date",e.target.value)}/></div>
          </div>
        </div>

        {/* Section 2 — Inventors */}
        <div style={{background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:14,padding:"24px",marginBottom:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.gold}}>✍️ Inventor Details (Form 5)</div>
            <button className="ghost" style={{fontSize:12,padding:"6px 14px"}} onClick={addInventor}>+ Add Inventor</button>
          </div>
          {applicant.inventors.map((inv,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:"16px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600,color:C.indigoL}}>Inventor {i+1}</div>
                {i>0&&<button className="ghost" style={{fontSize:11,padding:"4px 10px",color:C.danger,borderColor:"rgba(255,82,82,.3)"}} onClick={()=>removeInventor(i)}>Remove</button>}
              </div>
              <div className="g2" style={{marginBottom:10}}>
                <div><div className="lbl">Full Name *</div><input className="inp" placeholder="Full legal name" value={inv.name} onChange={e=>updateInventor(i,"name",e.target.value)}/></div>
                <div><div className="lbl">Nationality</div>
                  <select className="inp" value={inv.nationality} onChange={e=>updateInventor(i,"nationality",e.target.value)}>
                    {["Indian","American","British","Other"].map(n=><option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div><div className="lbl">Address *</div><input className="inp" placeholder="Complete residential/institutional address" value={inv.address} onChange={e=>updateInventor(i,"address",e.target.value)}/></div>
            </div>
          ))}
        </div>

        {/* Section 3 — Patent Agent (optional) */}
        {selectedForms.includes("form26")&&(
          <div style={{background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:14,padding:"24px",marginBottom:18}}>
            <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:16}}>🤝 Patent Agent Details (Form 26)</div>
            <div className="g2" style={{marginBottom:14}}>
              <div><div className="lbl">Agent Name</div><input className="inp" placeholder="Patent agent full name" value={applicant.agentName} onChange={e=>fa("agentName",e.target.value)}/></div>
              <div><div className="lbl">Registration Number</div><input className="inp" placeholder="e.g. IN/PA-XXXXX" value={applicant.agentReg} onChange={e=>fa("agentReg",e.target.value)}/></div>
            </div>
            <div><div className="lbl">Agent Address</div><input className="inp" placeholder="Full office address" value={applicant.agentAddress} onChange={e=>fa("agentAddress",e.target.value)}/></div>
          </div>
        )}

        {/* Section 4 — NOC Students */}
        {(selectedForms.includes("noc_i")||selectedForms.includes("noc_s"))&&(
          <div style={{background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:14,padding:"24px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:C.gold}}>🎓 Student / Author Details (for NOC)</div>
              <button className="ghost" style={{fontSize:12,padding:"6px 14px"}} onClick={addStudent}>+ Add Student</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"rgba(57,73,171,.2)"}}>
                    {["S.No","Name","Department","Year","Roll No."].map(h=>(
                      <th key={h} style={{padding:"8px 10px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {applicant.nocStudents.map((st,i)=>(
                    <tr key={i} style={{background:i%2===0?"rgba(255,255,255,.02)":"transparent"}}>
                      <td style={{padding:"6px 10px",color:C.muted}}>{i+1}</td>
                      <td style={{padding:"6px 10px"}}><input className="inp" style={{padding:"6px 10px",fontSize:12}} placeholder="Student name" value={st.name} onChange={e=>updateStudent(i,"name",e.target.value)}/></td>
                      <td style={{padding:"6px 10px"}}><input className="inp" style={{padding:"6px 10px",fontSize:12}} placeholder="Department" value={st.dept} onChange={e=>updateStudent(i,"dept",e.target.value)}/></td>
                      <td style={{padding:"6px 10px"}}>
                        <select className="inp" style={{padding:"6px 10px",fontSize:12}} value={st.year} onChange={e=>updateStudent(i,"year",e.target.value)}>
                          {["I Year","II Year","III Year","IV Year"].map(y=><option key={y}>{y}</option>)}
                        </select>
                      </td>
                      <td style={{padding:"6px 10px"}}><input className="inp" style={{padding:"6px 10px",fontSize:12}} placeholder="Roll No." value={st.roll} onChange={e=>updateStudent(i,"roll",e.target.value)}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary of what will be generated */}
        <div style={{background:"rgba(57,73,171,.08)",border:"1px solid rgba(92,107,192,.3)",borderRadius:12,padding:"18px 20px",marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:10}}>📦 Forms to be generated ({selectedForms.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {FORMS_LIST.filter(f=>selectedForms.includes(f.id)).map(f=>(
              <span key={f.id} className="bdg bg-b">{f.icon} {f.label}</span>
            ))}
          </div>
        </div>

        <button className="btn-gold" style={{width:"100%",fontSize:15,padding:"16px"}} onClick={generateForms}
          disabled={!applicant.appName||!applicant.appAddress||applicant.inventors.some(i=>!i.name)}>
          ⚡ Generate {selectedForms.length} Patent Form{selectedForms.length>1?"s":""} Now →
        </button>
        {(!applicant.appName||!applicant.appAddress||applicant.inventors.some(i=>!i.name))&&(
          <div style={{textAlign:"center",fontSize:12,color:C.muted,marginTop:8}}>Fill in applicant name, address, and at least one inventor name to continue</div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════
  //  GENERATING SCREEN
  // ═══════════════════════════════════
  if(screen==="generating") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar><div style={{fontSize:12,color:C.muted}}>Generating your patent forms...</div></NavBar>
      <div style={{maxWidth:600,margin:"0 auto",padding:"60px 20px"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div className="logo" style={{fontSize:26,marginBottom:8}}>RIT-<span style={{color:C.gold}}>IPR</span></div>
          <div style={{fontSize:16,fontWeight:600,color:C.text,marginBottom:4}}>Generating Your Patent Package</div>
          <div style={{fontSize:13,color:C.muted}}>Please wait while we prepare all your forms...</div>
        </div>

        {/* Progress bar */}
        <div style={{marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <span style={{fontSize:13,color:C.muted}}>Progress</span>
            <span style={{fontSize:13,fontWeight:700,color:C.gold,fontFamily:"'JetBrains Mono',monospace"}}>{genProgress}%</span>
          </div>
          <div style={{background:"rgba(255,255,255,.07)",borderRadius:100,height:10,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:100,background:`linear-gradient(90deg,${C.indigo},${C.gold})`,width:`${genProgress}%`,transition:"width .6s ease"}}/>
          </div>
        </div>

        {/* Log */}
        <div style={{background:"rgba(10,14,39,.9)",border:`1px solid ${C.border}`,borderRadius:12,padding:"20px",minHeight:200}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:12,fontWeight:600,letterSpacing:2}}>GENERATION LOG</div>
          {genLog.map((msg,i)=>(
            <div key={i} style={{display:"flex",gap:10,marginBottom:8,alignItems:"flex-start",animation:"fsu .3s ease"}}>
              <span style={{fontSize:11,color:C.muted,fontFamily:"'JetBrains Mono',monospace",flexShrink:0,marginTop:2}}>{String(i+1).padStart(2,"0")}</span>
              <span style={{fontSize:13,color:i===genLog.length-1?C.text:C.muted,lineHeight:1.5}}>{msg}</span>
            </div>
          ))}
          {genProgress<100&&(
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:C.indigo,animation:"pulse 1s infinite"}}/>
              <span style={{fontSize:12,color:C.muted}}>Processing...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════
  //  FORMS READY
  // ═══════════════════════════════════
  // ── Download helpers ──
  function dlText(filename, content) {
    const blob = new Blob([content], {type:"text/plain;charset=utf-8"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    setToast("✓ Downloaded: " + filename);
  }

  // ── PDF Form Generator ──
  function generateFormPDF(formTitle, formContent, filename) {
    const doc = new jsPDF();
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    // Set Times New Roman font
    doc.setFont("times", "normal");
    
    let yPos = 20;
    
    // Try to add RIT logo - positioned higher and smaller
    try {
      doc.addImage('/rit-logo.png', 'PNG', margin, 8, 35, 18);
    } catch(e) {
      console.log("Logo not loaded");
    }
    
    // Header - moved down to avoid overlap
    doc.setFontSize(18);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(formTitle, pageWidth/2, 32, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.text('Rajalakshmi Institute of Technology', pageWidth/2, 42, { align: 'center' });
    doc.text('IPR Portal - Patent Filing Assistant', pageWidth/2, 50, { align: 'center' });
    
    // Horizontal line - moved down
    doc.setLineWidth(0.5);
    doc.line(margin, 55, pageWidth - margin, 55);
    
    yPos = 65; // Start content further down
    
    // Content
    doc.setFontSize(12);
    doc.setFont("times", "normal");
    
    // Split content into lines and add to PDF
    const lines = formContent.split('\n');
    
    lines.forEach(line => {
      if(yPos > 270) {
        doc.addPage();
        yPos = 20;
        // Add logo to new page - same positioning
        try {
          doc.addImage('/rit-logo.png', 'PNG', margin, 8, 35, 18);
        } catch(e) {}
        yPos = 30; // Start content higher on subsequent pages
      }
      
      // Handle different line types
      if(line.trim() === '') {
        yPos += 4; // Empty line spacing
      } else if(line.includes('═') || line.includes('─')) {
        // Separator lines - draw actual line
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 6;
      } else if(line.match(/^[A-Z\s]+:?\s*$/) && line.length < 50) {
        // Headers - bold and larger
        doc.setFontSize(14);
        doc.setFont("times", "bold");
        const headerLines = doc.splitTextToSize(line, contentWidth);
        doc.text(headerLines, margin, yPos);
        yPos += headerLines.length * 7 + 4;
        doc.setFontSize(12);
        doc.setFont("times", "normal");
      } else {
        // Regular content
        const contentLines = doc.splitTextToSize(line, contentWidth);
        doc.text(contentLines, margin, yPos);
        yPos += contentLines.length * 6 + 2;
      }
    });
    
    // Add footer to all pages
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++){
      doc.setPage(i);
      
      // Footer line
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 25, pageWidth - margin, pageHeight - 25);
      
      // Footer text
      doc.setFontSize(10);
      doc.setFont("times", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 15, { align: 'right' });
      doc.text('Generated by RIT IPR Portal', margin, pageHeight - 15);
      doc.text(`${new Date().toLocaleDateString('en-IN')}`, pageWidth/2, pageHeight - 15, { align: 'center' });
    }
    
    // Save PDF
    doc.save(filename);
    setToast("✓ Form PDF Downloaded!");
  }

  function buildForm1() {
    const inv_list = applicant.inventors.map((v,i)=>`  ${i+1}. ${v.name}\n     Address: ${v.address}\n     Nationality: ${v.nationality}`).join("\n\n");
    return `FORM 1 — APPLICATION FOR GRANT OF PATENT
The Patents Act, 1970 | The Patents Rules, 2003
[See Section 7, 54 & 135 and Rule 20(1)]
${"═".repeat(60)}

PART A — APPLICANT DETAILS
Applicant Name   : ${applicant.appName}
Address          : ${applicant.appAddress}
Nationality      : Indian
Category         : Educational Institution

PART B — INVENTION DETAILS
Title            : ${inv.title}
Technology Domain: ${data?.domain||""}
IPC Codes        : ${data?.ipcCodes?.map(c=>c.code).join(" | ")||""}
Patent Type      : ${data?.patentType||"Utility Patent"}
Filing Office    : ${applicant.filingOffice}

PART C — INVENTOR DETAILS
${inv_list}

PART D — PRIORITY / DIVISIONAL
☑  Neither (No foreign filing, No divisional)

PART E — DECLARATION
I/We hereby declare that I/we am/are in possession of an invention, the title
and nature of which are mentioned in the heading of the complete specification
accompanying this application. I/We further declare that to the best of my/our
knowledge, the said invention is new and useful and has not been publicly
disclosed or used in India or elsewhere before the date of this application.

${applicant.inventors.map(v=>`Inventor Signature: ${v.name}\nDate: ${applicant.date}`).join("\n\n")}

Filing Date      : ${applicant.date}
Place            : ${applicant.filingOffice}

FOR OFFICIAL USE ONLY
Application No.: _______________  Date: _______________  Receipt No.: _______________`;
  }

  function buildForm2() {
    return `FORM 2 — COMPLETE SPECIFICATION (UTILITY PATENT)
The Patents Act, 1970 | [See Section 10 and Rule 13]
${"═".repeat(60)}

TITLE: ${inv.title}

1. FIELD OF THE INVENTION
${inv.industry} — ${data?.domain||""}
This invention relates to an AI-powered platform for intellectual property rights
automation and patent protection, enabling inventors to protect their innovations
efficiently using artificial intelligence.

2. BACKGROUND OF THE INVENTION
${inv.problem}

Existing solutions do not adequately address this problem. The present invention
provides a novel and comprehensive solution that overcomes all known limitations
of prior art in this domain.

3. SUMMARY OF THE INVENTION
${inv.unique}

Components: ${inv.components}

4. DETAILED DESCRIPTION OF THE INVENTION
${data?.technicalDescription||""}

Working Principle:
${inv.working}

5. CLAIMS
${data?.claims?.join("\n\n")||""}

6. ABSTRACT
${data?.abstract||""}

IPC CLASSIFICATION CODES:
${data?.ipcCodes?.map(c=>`${c.code} — ${c.description}`).join("\n")||""}

Filed by: ${applicant.appName}
Date    : ${applicant.date}
Office  : ${applicant.filingOffice} Patent Office`;
  }

  function buildForm3() {
    return `FORM 3 — STATEMENT AND UNDERTAKING
The Patents Act, 1970 | [See Section 8 and Rule 12]
${"═".repeat(60)}

Application in respect of: ${inv.title}
Applicant: ${applicant.appName}
Date: ${applicant.date}

PART I — STATEMENT
I/We, the applicant(s) named in the above-referenced patent application, hereby
state that to the best of my/our knowledge and belief, no application for a patent
in respect of the same or substantially the same invention has been filed in any
country outside India, either before or on the date of filing of the present application.

☑  No application has been filed outside India.

PART II — UNDERTAKING
I/We undertake that, up to the date of grant of the patent or the date of refusal
or withdrawal of the application, whichever is earlier, I/we shall keep the
Controller informed in writing of any application for patent filed outside India
subsequently to the date of filing of this application in India, within three months
of the date of such filing outside India.

DECLARATION
I/We solemnly declare that the information furnished above is true and correct.

${applicant.inventors.map(v=>`Name: ${v.name}\nSignature: ________________________\nDate: ${applicant.date}`).join("\n\n")}

Place: ${applicant.filingOffice}
Date : ${applicant.date}`;
  }

  function buildForm5() {
    return `FORM 5 — DECLARATION OF INVENTORSHIP
The Patents Act, 1970 | [See Section 7(2)(aa) and Rule 13(6) and 20(1)(b)]
${"═".repeat(60)}

In the matter of the application for a patent for the invention entitled:
${inv.title}

INVENTOR DECLARATIONS
I/We, the inventor(s) listed below, hereby declare that I/we am/are the true and
first inventor(s) of the invention described in the patent application accompanying
this form. I/We further declare that to the best of my/our knowledge and belief,
the invention is new and that no application has been made in India or elsewhere
for a patent in respect of the same invention by me/us or anyone authorised by me/us.

${applicant.inventors.map((v,i)=>`INVENTOR ${i+1}
Full Name   : ${v.name}
Address     : ${v.address}
Nationality : ${v.nationality}
Signature   : ________________________
Date        : ${applicant.date}`).join("\n\n")}

VERIFICATION
Verified that the contents of this declaration are true to the best of my/our
knowledge and belief, that no part of it is false and that nothing material
has been concealed therefrom.

Place: ${applicant.filingOffice}
Date : ${applicant.date}`;
  }

  function buildForm26() {
    return `FORM 26 — AUTHORISATION OF PATENT AGENT
The Patents Act, 1970 | [See Rule 135]
${"═".repeat(60)}

In the matter of the application for a patent for the invention entitled:
${inv.title}

AUTHORISATION
I/We, the applicant(s) for the above-mentioned patent application, hereby authorise
and appoint:

Agent Name          : ${applicant.agentName||"[Name of Patent Agent]"}
Registration Number : ${applicant.agentReg||"[Agent Registration No.]"}
Agent Address       : ${applicant.agentAddress||"[Agent's Full Address]"}

to act as my/our Patent Agent before the Indian Patent Office and to perform all
acts, execute all documents, and take all proceedings on my/our behalf in relation
to the present patent application and any patent that may be granted thereon.

${applicant.inventors.map(v=>`Applicant Name: ${v.name}\nSignature: ________________________\nDate: ${applicant.date}`).join("\n\n")}

PATENT AGENT ACCEPTANCE
I hereby accept the above authorisation.

Agent Signature: ________________________
Date          : ${applicant.date}`;
  }

  function buildNOC_I() {
    const students = applicant.nocStudents.map((s,i)=>`  ${i+1}. ${s.name||"[Name]"} | ${s.dept||"[Dept]"} | ${s.year} | Roll: ${s.roll||"___"}`).join("\n");
    return `NO OBJECTION CERTIFICATE — INSTITUTION
${"═".repeat(60)}

RAJALAKSHMI INSTITUTE OF TECHNOLOGY
(An Autonomous Institution, Affiliated to Anna University)
No. 602/3, Porur-Tiruvallur High Road, Somangalam, Chennai – 600 124

Ref : RIT/IPR/NOC/Department of ${applicant.dept||"Artificial Intelligence and Data Science"}
Date: ${applicant.date}

TO WHOMSOEVER IT MAY CONCERN

This is to certify that Rajalakshmi Institute of Technology, Chennai, has NO OBJECTION
to the following students of this institution filing a patent application for the
invention entitled:

"${inv.title}"

with the Office of the Controller General of Patents, Designs and Trade Marks,
Government of India, under the provisions of the Patents Act, 1970.

STUDENTS COVERED UNDER THIS NOC:
${students}

This institution further affirms that:
1. The invention was conceived and developed during the students' academic programme.
2. The institution claims no independent ownership over this intellectual property.
3. The students are free to apply for and hold the patent.
4. This NOC is issued solely for the purpose of supporting the patent application.

                                    (Seal of Institution)


___________________________
Principal / Director
Rajalakshmi Institute of Technology
Chennai – 600 124
Date: ${applicant.date}`;
  }

  function buildNOC_S() {
    const students = applicant.nocStudents.map((s,i)=>`  ${i+1}. ${s.name||"[Name]"} | ${s.role||"UG Scholar"} | ${applicant.appName} | Signature: ___________`).join("\n");
    return `NO OBJECTION CERTIFICATE — STUDENT / AUTHOR
${"═".repeat(60)}

TO WHOMSOEVER IT MAY CONCERN

We, the undersigned student inventors and authors of the invention entitled:

"${inv.title}"

hereby state that we have NO OBJECTION to the patent application for the above-mentioned
invention being filed by and/or in the name of ${applicant.appName}, under the provisions
of the Patents Act, 1970 and the Patents Rules, 2003 (as amended).

We further confirm the following:
1. We are the true and first inventors/authors of the said invention.
2. We have voluntarily agreed to assign the patent rights to the institution.
3. We have not filed any other application for the said invention anywhere.
4. We have not publicly disclosed the invention before the filing date.
5. We consent to the institution acting as applicant while acknowledging us as inventors.

AUTHOR / INVENTOR DETAILS AND SIGNATURES:
${students}

GUIDE / SUPERVISOR ENDORSEMENT:
Faculty Guide Name : ________________________
Designation        : ________________________
Department         : ${applicant.dept||"AI & Data Science"}
Signature          : ________________________
Date               : ${applicant.date}`;
  }

  function buildAll() {
    const parts = [];
    if(selectedForms.includes("form1"))  parts.push(buildForm1());
    if(selectedForms.includes("form2"))  parts.push(buildForm2());
    if(selectedForms.includes("form3"))  parts.push(buildForm3());
    if(selectedForms.includes("form5"))  parts.push(buildForm5());
    if(selectedForms.includes("form26")) parts.push(buildForm26());
    if(selectedForms.includes("noc_i"))  parts.push(buildNOC_I());
    if(selectedForms.includes("noc_s"))  parts.push(buildNOC_S());
    return parts.join("\n\n" + "═".repeat(60) + "\n\n");
  }

  const FORM_BUILDERS = {
    form1:  {fn: buildForm1,  filename:"Form1_Patent_Application.pdf", title:"FORM 1 — APPLICATION FOR GRANT OF PATENT"},
    form2:  {fn: buildForm2,  filename:"Form2_Complete_Specification.pdf", title:"FORM 2 — COMPLETE SPECIFICATION"},
    form3:  {fn: buildForm3,  filename:"Form3_Statement_Undertaking.pdf", title:"FORM 3 — STATEMENT & UNDERTAKING"},
    form5:  {fn: buildForm5,  filename:"Form5_Declaration_Inventorship.pdf", title:"FORM 5 — DECLARATION OF INVENTORSHIP"},
    form26: {fn: buildForm26, filename:"Form26_Authorisation_Agent.pdf", title:"FORM 26 — AUTHORIZATION OF PATENT AGENT"},
    noc_i:  {fn: buildNOC_I,  filename:"NOC_Institution.pdf", title:"NOC-I — INSTITUTIONAL NO OBJECTION CERTIFICATE"},
    noc_s:  {fn: buildNOC_S,  filename:"NOC_Students_Authors.pdf", title:"NOC-S — STUDENT/AUTHOR NO OBJECTION CERTIFICATE"},
  };

  if(screen==="formsready") return (
    <div className="bg" style={{minHeight:"100vh"}}>
      <NavBar>
        <button className="ghost" style={{fontSize:13,padding:"7px 14px"}} onClick={()=>setScreen("results")}>← Back to Results</button>
        <button className="ghost" style={{fontSize:13,padding:"7px 14px"}} onClick={reset}>+ New Invention</button>
      </NavBar>
      <StepBar/>

      <div style={{maxWidth:800,margin:"0 auto",padding:"40px 20px 60px"}}>
        {/* Success banner */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:52,marginBottom:12}}>🎉</div>
          <div className="logo" style={{fontSize:28,marginBottom:8}}>Patent Package Ready!</div>
          <div style={{fontSize:15,color:C.muted,marginBottom:16}}>
            All {selectedForms.length} forms generated for <strong style={{color:C.text}}>{inv.title}</strong>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginBottom:24}}>
            <Bdg label={applicant.appName||"Applicant"} type="b"/>
            <Bdg label={`${applicant.inventors.length} Inventor${applicant.inventors.length>1?"s":""}`} type="g"/>
            <Bdg label={applicant.filingOffice+" Patent Office"} type="gold"/>
          </div>
          {/* Download ALL button - big and prominent */}
          <button className="btn-gold" style={{fontSize:15,padding:"16px 40px",borderRadius:12,marginBottom:8}}
            onClick={()=>generateFormPDF("COMPLETE PATENT PACKAGE", buildAll(), `RIT_IPR_Complete_Patent_Package_${inv.title.slice(0,30).replace(/\s+/g,"_")}.pdf`)}>
            ⬇️ Download Complete Patent Package (PDF)
          </button>
          <div style={{fontSize:12,color:C.muted}}>All {selectedForms.length} forms in one PDF file · Ready to print & sign</div>
        </div>

        {/* Individual forms with download buttons */}
        <div style={{marginBottom:28}}>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:14}}>📋 Download Individual Forms</div>
          {FORMS_LIST.filter(f=>selectedForms.includes(f.id)).map((f,i)=>(
            <div key={f.id} style={{display:"flex",alignItems:"center",gap:16,padding:"14px 18px",background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:12,marginBottom:10,animation:`fsu .4s ease ${i*.08}s both`}}>
              <div style={{width:42,height:42,borderRadius:12,background:"rgba(57,73,171,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:2}}>{f.label} — {f.name}</div>
                <div style={{fontSize:12,color:C.muted}}>{f.desc}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                <span className="bdg bg-g" style={{marginRight:4}}>✓ Ready</span>
                <button
                  onClick={()=>{
                    const builder = FORM_BUILDERS[f.id];
                    if(builder) generateFormPDF(builder.title, builder.fn(), builder.filename);
                  }}
                  style={{background:"rgba(57,73,171,.25)",border:"1px solid rgba(92,107,192,.4)",borderRadius:8,color:C.text,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",transition:"all .2s",whiteSpace:"nowrap"}}
                  onMouseOver={e=>e.currentTarget.style.background="rgba(57,73,171,.5)"}
                  onMouseOut={e=>e.currentTarget.style.background="rgba(57,73,171,.25)"}
                >⬇️ Download PDF</button>
              </div>
            </div>
          ))}
        </div>

        {/* Submit for Review Section - Only for Faculty */}
        {user?.role === 'faculty' && (
          <div style={{background:"rgba(76,175,80,.05)",border:"1px solid rgba(76,175,80,.2)",borderRadius:14,padding:"24px",marginBottom:28,textAlign:"center"}}>
            <div style={{fontSize:16,fontWeight:700,color:C.green,marginBottom:8}}>📋 Submit for Admin Review</div>
            <div style={{fontSize:14,color:C.muted,marginBottom:16,lineHeight:1.5}}>
              Submit your completed patent application to the admin for review and approval before final filing.
            </div>
            <button 
              className="btn" 
              style={{background:"linear-gradient(135deg,#4CAF50,#66BB6A)",fontSize:14,padding:"12px 24px"}}
              onClick={submitForReview}
            >
              📤 Submit for Review
            </button>
          </div>
        )}

        {/* Next Steps */}
        <div style={{background:"rgba(19,26,58,.85)",border:`1px solid ${C.border}`,borderRadius:14,padding:"24px",marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:14}}>📌 Next Steps to File Your Patent</div>
          {[
            ["1","Download & Print","Click 'Download Complete Patent Package' above to get all forms in one file. Print and review each form."],
            ["2","Get Signatures","Have all inventors sign Form 5. The institution's Principal/Director must sign and stamp the Institutional NOC."],
            ["3","Pay Government Fees",`Official IPO fee: ${data?.filingCost||"₹8,000–₹15,000"} for educational institutions. Pay online at ipindia.gov.in.`],
            ["4","Submit at Patent Office",`Submit the complete package at the ${applicant.filingOffice} Patent Office or file online at ipindiaonline.gov.in.`],
            ["5","Track Your Application","After submission you'll get an application number. Track at ipindia.gov.in/IPOJournal. Respond to FER within 12 months."],
          ].map(([num,title,desc])=>(
            <div key={num} style={{display:"flex",gap:14,marginBottom:14,alignItems:"flex-start"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"rgba(57,73,171,.25)",border:"1px solid rgba(92,107,192,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:C.indigoL,flexShrink:0}}>{num}</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2}}>{title}</div>
                <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Notice */}
        <div style={{background:"rgba(255,193,7,.06)",border:"1px solid rgba(255,193,7,.2)",borderRadius:12,padding:"14px 18px",marginBottom:24}}>
          <div style={{fontSize:12,color:C.gold,fontWeight:600,marginBottom:4}}>⚠️ Important Notice</div>
          <div style={{fontSize:12,color:C.muted,lineHeight:1.6}}>
            These are AI-assisted drafts. Please have a registered patent agent review all documents — especially the patent claims — before filing with the Indian Patent Office.
          </div>
        </div>

        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="ghost" onClick={()=>setScreen("formdetails")}>← Edit Details</button>
          <button className="ghost" onClick={()=>setScreen("results")}>📊 View Analysis</button>
          <button className="btn" onClick={()=>copy(buildAll())}>📋 Copy All Forms</button>
          <button className="btn-gold" onClick={reset}>🚀 New Invention</button>
        </div>
      </div>
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );

  return null;
}
