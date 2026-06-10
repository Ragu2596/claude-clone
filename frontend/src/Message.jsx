// frontend/src/components/Message.jsx
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { RkLogo, CopyIcon, RefreshIcon, ThumbUpIcon, ThumbDownIcon, DownloadIcon, OpenIcon, PencilIcon, TrashIcon } from "./icons";

const FILE_EXT_MAP = { javascript:"js",js:"js",typescript:"ts",ts:"ts",jsx:"jsx",tsx:"tsx",python:"py",py:"py",java:"java",kotlin:"kt",swift:"swift",go:"go",rust:"rs",cpp:"cpp",c:"c",cs:"cs",php:"php",ruby:"rb",html:"html",css:"css",scss:"scss",xml:"xml",json:"json",yaml:"yaml",yml:"yml",toml:"toml",sql:"sql",graphql:"graphql",sh:"sh",bash:"sh",markdown:"md",md:"md",svg:"svg",csv:"csv",dockerfile:"dockerfile",txt:"txt" };
function getFileExt(lang) { return FILE_EXT_MAP[lang?.toLowerCase()] || "txt"; }
function downloadFile(code, lang) {
  const ext=getFileExt(lang); const blob=new Blob([code],{type:"text/plain;charset=utf-8"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=`rkai-file.${ext}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function formatTime(ts) {
  if (!ts) return "";
  const d=new Date(ts), now=new Date(), diff=(now-d)/1000;
  if (diff<60) return "just now";
  if (diff<3600) return `${Math.floor(diff/60)}m ago`;
  if (d.toDateString()===now.toDateString()) return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  return d.toLocaleDateString([],{month:"short",day:"numeric"});
}

function CopyBtn({ text, iconOnly=false }) {
  const [copied,setCopied]=useState(false);
  const copy=()=>{ navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const label = copied?"Copied!":"Copy";
  if (iconOnly) return (
    <button onClick={copy} title={label} style={{ background:"none", border:"1px solid transparent", borderRadius:6, padding:"4px 7px", fontSize:12, color:"var(--text3)", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
      onMouseEnter={e=>{e.currentTarget.style.background="var(--hover)";e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="transparent";e.currentTarget.style.color="var(--text3)";}}>
      <CopyIcon size={13}/>{label}
    </button>
  );
  return (
    <button onClick={copy} style={{ background:"rgba(0,0,0,0.05)", border:"1px solid rgba(0,0,0,0.1)", borderRadius:5, padding:"3px 9px", fontSize:11, color:"var(--text2)", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
      onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.1)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.05)"}>
      <CopyIcon size={11}/>{label}
    </button>
  );
}

function ActionBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{ background:"none", border:"1px solid transparent", borderRadius:6, padding:"4px 7px", fontSize:12, color:"var(--text3)", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}
      onMouseEnter={e=>{e.currentTarget.style.background="var(--hover)";e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--text2)";}}
      onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor="transparent";e.currentTarget.style.color="var(--text3)";}}>
      {children}
    </button>
  );
}

export default function Message({ msg, isLast, streaming, onArtifact, activeArtifactCode, onRetry, onEdit }) {
  const isUser = msg.role==="user";
  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [expanded, setExpanded] = useState(false);

  if (isUser) return (
    <div className="user-wrap" style={{ display:"flex", justifyContent:"flex-end", padding:"6px 0", marginBottom:6, animation:"fadeUp .25s ease forwards" }}>
      <div style={{ maxWidth:"85%" }}>
        {msg.fileUrl && (
          <div style={{ marginBottom:6, display:"flex", justifyContent:"flex-end" }}>
            {(msg.fileType||"").startsWith("image/")
              ? <img src={msg.fileUrl} alt="" style={{ maxWidth:220, maxHeight:180, borderRadius:10, border:"1px solid var(--border)" }}/>
              : <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"#eee", border:"1px solid var(--border)", borderRadius:9, padding:"7px 11px", fontSize:12, color:"var(--text2)" }}>{msg.fileName}</div>}
          </div>
        )}
        {editing ? (
          <div style={{ background:"#fff", border:"1px solid var(--orange)", borderRadius:14, padding:10, minWidth:240 }}>
            <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={3} autoFocus style={{ width:"100%", background:"none", border:"none", outline:"none", fontSize:14, color:"var(--text)", resize:"none", fontFamily:"inherit", lineHeight:1.6 }}/>
            <div style={{ display:"flex", gap:6, justifyContent:"flex-end", marginTop:6 }}>
              <button onClick={()=>{setEditing(false);setEditText(msg.content);}} style={{ padding:"5px 12px", background:"none", border:"1px solid var(--border)", borderRadius:7, fontSize:12, cursor:"pointer", color:"var(--text2)" }}>Cancel</button>
              <button onClick={()=>{setEditing(false);if(editText.trim()&&editText!==msg.content)onEdit?.(editText.trim());}} style={{ padding:"5px 12px", background:"var(--orange)", border:"none", borderRadius:7, fontSize:12, fontWeight:600, color:"#fff", cursor:"pointer" }}>Send</button>
            </div>
          </div>
        ) : (
          <div style={{ background:"var(--user-bubble)", borderRadius:18, borderBottomRightRadius:4, padding:"11px 16px", color:"#fff", fontSize:15, lineHeight:1.65 }}>
            {msg.content.length<=300
              ? <span style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{msg.content}</span>
              : <div>
                  <div style={{maxHeight:expanded?"none":"140px",overflow:"hidden",position:"relative",wordBreak:"break-word",whiteSpace:"pre-wrap"}}>
                    {msg.content}
                    {!expanded&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:40,background:"linear-gradient(transparent,rgba(0,0,0,0.3))"}}/>}
                  </div>
                  <button onClick={()=>setExpanded(e=>!e)} style={{marginTop:4,fontSize:11,color:"rgba(255,255,255,0.6)",background:"none",border:"none",cursor:"pointer",padding:0}}>
                    {expanded?"Show less":`Show more (${msg.content.length} chars)`}
                  </button>
                </div>
            }
          </div>
        )}
        <div className="user-actions" style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, marginTop:4 }}>
          {!editing && onEdit && (
            <button onClick={()=>setEditing(true)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex", alignItems:"center", gap:3, fontSize:11, padding:"2px 4px", borderRadius:5 }}
              onMouseEnter={e=>{e.currentTarget.style.color="var(--text2)";e.currentTarget.style.background="var(--hover)";}}
              onMouseLeave={e=>{e.currentTarget.style.color="var(--text3)";e.currentTarget.style.background="none";}}>
              <PencilIcon size={12}/> Edit
            </button>
          )}
          {msg.createdAt && <span style={{ fontSize:10.5, color:"var(--text3)" }}>{formatTime(msg.createdAt)}</span>}
        </div>
      </div>
    </div>
  );

  const isEmpty = !msg.content && streaming && isLast;
  return (
    <div className="msg-wrap" style={{ display:"flex", gap:14, padding:"10px 0", animation:"fadeUp .25s ease forwards" }}>
      <div style={{ flexShrink:0, marginTop:3 }}><RkLogo size={26}/></div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:600, color:"var(--text3)", marginBottom:4 }}>rk.ai</div>
        {isEmpty ? (
          <div style={{ display:"flex", gap:5, alignItems:"center", height:28, paddingTop:6 }}>
            {[0,.18,.36].map((d,i)=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"var(--orange)", animation:`dot 1.2s ease ${d}s infinite` }}/>)}
          </div>
        ) : (
          <>
            <div className="prose" style={{ fontSize:15, lineHeight:1.75, color:"var(--text)" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({node,inline,className,children,...props}){
                  const match=/language-(\w+)/.exec(className||"");
                  const code=String(children).replace(/\n$/,"");
                  if (!inline && match) {
                    const lang=(match[1]||"text").toLowerCase();
                    const ext=getFileExt(lang);
                    const isActive=activeArtifactCode===code;
                    return (
                      <div style={{ borderRadius:10, overflow:"hidden", border:`1px solid ${isActive?"var(--orange)":"var(--border)"}`, margin:"14px 0" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 12px", background:"#f3efe9", borderBottom:"1px solid var(--border)" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:"var(--text2)", fontFamily:"monospace", letterSpacing:"0.04em" }}>{lang}</span>
                            <span style={{ fontSize:10, color:"var(--text3)" }}>· {code.split("\n").length} lines</span>
                          </div>
                          <div style={{ display:"flex", gap:5 }}>
                            <button onClick={()=>onArtifact&&onArtifact(code,lang)} style={{ background:isActive?"var(--orange)":"#eee", border:"1px solid var(--border)", borderRadius:5, padding:"3px 9px", color:isActive?"#fff":"var(--text2)", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                              <OpenIcon size={11}/>{isActive?"Viewing":"Open"}
                            </button>
                            <button onClick={()=>downloadFile(code,lang)} style={{ background:"#eee", border:"1px solid var(--border)", borderRadius:5, padding:"3px 9px", color:"var(--text2)", fontSize:11, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                              <DownloadIcon size={11}/>.{ext}
                            </button>
                            <CopyBtn text={code}/>
                          </div>
                        </div>
                        <SyntaxHighlighter style={oneLight} language={lang} PreTag="div"
                          customStyle={{ margin:0, padding:"14px 16px", fontSize:13, fontFamily:"monospace", background:"#fafafa", lineHeight:1.55 }} {...props}>
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return <code style={{ background:"rgba(0,0,0,0.07)", borderRadius:4, padding:"1px 5px", fontFamily:"monospace", fontSize:13 }} {...props}>{children}</code>;
                },
                p:({children})=><p style={{marginBottom:10,lineHeight:1.75}}>{children}</p>,
                ul:({children})=><ul style={{paddingLeft:22,marginBottom:10}}>{children}</ul>,
                ol:({children})=><ol style={{paddingLeft:22,marginBottom:10}}>{children}</ol>,
                li:({children})=><li style={{marginBottom:4}}>{children}</li>,
                h1:({children})=><h1 style={{fontSize:20,fontWeight:700,marginTop:20,marginBottom:8}}>{children}</h1>,
                h2:({children})=><h2 style={{fontSize:17,fontWeight:700,marginTop:18,marginBottom:7}}>{children}</h2>,
                h3:({children})=><h3 style={{fontSize:15,fontWeight:600,marginTop:14,marginBottom:5}}>{children}</h3>,
                blockquote:({children})=><blockquote style={{borderLeft:"3px solid var(--orange)",paddingLeft:14,color:"var(--text2)",margin:"12px 0",fontStyle:"italic"}}>{children}</blockquote>,
                a:({children,href})=><a href={href} target="_blank" rel="noreferrer" style={{color:"var(--orange)",textDecoration:"underline"}}>{children}</a>,
                table:({children})=><div style={{overflowX:"auto",marginBottom:10}}><table style={{borderCollapse:"collapse",width:"100%",fontSize:14}}>{children}</table></div>,
                th:({children})=><th style={{background:"rgba(0,0,0,0.04)",padding:"7px 12px",border:"1px solid var(--border)",fontWeight:600,textAlign:"left"}}>{children}</th>,
                td:({children})=><td style={{padding:"6px 12px",border:"1px solid var(--border)"}}>{children}</td>,
                strong:({children})=><strong style={{fontWeight:700}}>{children}</strong>,
                hr:()=><hr style={{border:"none",borderTop:"1px solid var(--border)",margin:"14px 0"}}/>,
              }}>
                {msg.content}
              </ReactMarkdown>
            </div>
            {isLast && streaming && msg.content && <span style={{ display:"inline-block", width:2, height:17, background:"var(--text)", marginLeft:1, animation:"blink 1s ease infinite", verticalAlign:"middle" }}/>}
            {!streaming && msg.content && !msg.error && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
                <div className="msg-actions" style={{ display:"flex", gap:2 }}>
                  <CopyBtn text={msg.content} iconOnly/>
                  {onRetry && <ActionBtn onClick={onRetry} title="Retry"><RefreshIcon size={13}/> Retry</ActionBtn>}
                  <ActionBtn onClick={()=>{}} title="Good response"><ThumbUpIcon size={13}/></ActionBtn>
                  <ActionBtn onClick={()=>{}} title="Bad response"><ThumbDownIcon size={13}/></ActionBtn>
                </div>
                {msg.createdAt && <span style={{ fontSize:10.5, color:"var(--text3)", flexShrink:0 }}>{formatTime(msg.createdAt)}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
