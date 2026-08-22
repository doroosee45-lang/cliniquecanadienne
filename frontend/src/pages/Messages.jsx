


import { useState, useEffect, useCallback, useRef, useId } from "react";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import toast from "react-hot-toast";
import { MessageSquare, Plus, Bell } from 'lucide-react';
import Hero from '../components/UI/Hero';
import Button from '../components/UI/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CLINIC_NAME, CLINIC_SUBTITLE } from '../config/clinic';

// ─── CSS (same design system: Medical Navy + Teal) ────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.msg * { font-family:'Poppins',sans-serif; box-sizing:border-box; }
:root {
  --cn: #0B1E3B; --cn2: #132744; --cb: #1B4F9E;
  --ct: #0EA5A0; --ct2: #0D9490; --cr: #DC2626;
  --co: #D97706; --cg: #059669; --cp: #7C3AED;
  --cbr: #E2EAF4; --cm: #6B7A99; --cl: #EEF4FF; --cs: #F8FAFD;
  --sh: 0 1px 3px rgba(11,30,59,.08); --shm: 0 4px 16px rgba(11,30,59,.10); --shl: 0 12px 40px rgba(11,30,59,.14);
}

/* Topbar */
.msg-top { background:linear-gradient(135deg,var(--cn) 0%,var(--cn2) 55%,#1B4F9E 100%); padding:20px 24px 0; position:relative; overflow:hidden; }
.msg-top::before { content:''; position:absolute; top:-50px; right:-50px; width:200px; height:200px; background:radial-gradient(circle,rgba(14,165,160,.22) 0%,transparent 70%); border-radius:50%; pointer-events:none; }
.msg-top::after  { content:''; position:absolute; bottom:-30px; left:30%; width:160px; height:160px; background:radial-gradient(circle,rgba(27,79,158,.18) 0%,transparent 70%); border-radius:50%; pointer-events:none; }

/* Tabs */
.msg-tabs { display:flex; gap:2px; padding:0; margin-top:16px; overflow-x:auto; scrollbar-width:none; }
.msg-tabs::-webkit-scrollbar { display:none; }
.msg-tab { display:flex; align-items:center; gap:7px; padding:10px 18px 12px; font-size:12.5px; font-weight:600; color:rgba(255,255,255,.55); border:none; background:none; cursor:pointer; border-radius:10px 10px 0 0; transition:all .2s; white-space:nowrap; font-family:'Poppins',sans-serif; }
.msg-tab:hover { color:rgba(255,255,255,.88); background:rgba(255,255,255,.08); }
.msg-tab.active { color:var(--cn); background:var(--cs); box-shadow:0 -2px 0 var(--ct) inset; }
.msg-badge { background:var(--cr); color:#fff; font-size:10px; font-weight:700; padding:1px 7px; border-radius:99px; animation:msgP 2s infinite; }
@keyframes msgP { 0%,100%{opacity:1} 50%{opacity:.4} }

/* Main layout */
.msg-layout { display:grid; grid-template-columns:300px 1fr; height:calc(100vh - 148px); overflow:hidden; background:#fff; border-radius:0 0 18px 18px; border:1.5px solid var(--cbr); border-top:none; box-shadow:var(--sh); }

/* Sidebar */
.msg-sidebar { border-right:1.5px solid var(--cbr); display:flex; flex-direction:column; overflow:hidden; background:#FAFBFF; }
.msg-sidebar-hdr { padding:16px; border-bottom:1.5px solid var(--cbr); background:linear-gradient(to right,rgba(238,244,255,.8),#FAFBFF); }
.msg-search { position:relative; }
.msg-search input { width:100%; padding:8px 12px 8px 34px; border-radius:10px; border:1.5px solid var(--cbr); background:#fff; font-size:12.5px; color:var(--cn); font-family:'Poppins',sans-serif; outline:none; transition:border-color .2s; }
.msg-search input:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }
.msg-search-ic { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9CA3AF; }

/* Filters */
.msg-filters { display:flex; gap:4px; padding:8px 16px; border-bottom:1.5px solid var(--cbr); overflow-x:auto; scrollbar-width:none; }
.msg-filters::-webkit-scrollbar { display:none; }
.msg-filter { padding:4px 10px; border-radius:99px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid transparent; transition:all .2s; color:var(--cm); background:none; font-family:'Poppins',sans-serif; white-space:nowrap; }
.msg-filter:hover { background:#EEF4FF; color:var(--cn); }
.msg-filter.active { background:var(--cn); color:#fff; }

/* Conv list */
.msg-conv-list { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--cbr) transparent; }
.msg-conv-item { display:flex; align-items:center; gap:10px; padding:12px 16px; cursor:pointer; transition:background .15s; border-bottom:1px solid #F3F7FF; position:relative; }
.msg-conv-item:hover { background:#F0F5FF; }
.msg-conv-item.active { background:#EEF4FF; border-left:3px solid var(--ct); }
.msg-conv-item.unread .conv-name { font-weight:700; color:var(--cn); }
.msg-conv-item.unread .conv-preview { color:var(--cn); font-weight:500; }
.conv-av { width:42px; height:42px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; position:relative; }
.conv-av-status { position:absolute; bottom:-2px; right:-2px; width:12px; height:12px; border-radius:50%; border:2px solid #FAFBFF; }
.conv-name { font-size:13px; font-weight:600; color:var(--cn); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.conv-role { font-size:11px; color:var(--cm); }
.conv-preview { font-size:11.5px; color:#9CA3AF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.conv-time { font-size:10px; color:#9CA3AF; white-space:nowrap; flex-shrink:0; }
.conv-unread-dot { position:absolute; top:12px; right:12px; width:18px; height:18px; border-radius:50%; background:var(--ct); color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; }
.msg-section-lbl { padding:8px 16px 4px; font-size:10px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; background:#FAFBFF; border-bottom:1px solid #F3F7FF; }

/* Chat area */
.msg-chat { display:flex; flex-direction:column; overflow:hidden; }
.msg-chat-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.5),transparent); flex-shrink:0; }
.msg-chat-hdr-info { display:flex; align-items:center; gap:12px; }
.msg-chat-actions { display:flex; gap:8px; }

/* Messages area */
.msg-area { flex:1; overflow-y:auto; padding:20px; background:linear-gradient(to bottom,#F8FAFD,#EEF4FF10); scrollbar-width:thin; scrollbar-color:var(--cbr) transparent; display:flex; flex-direction:column; gap:6px; }

/* Bubble */
.msg-bubble-wrap { display:flex; gap:8px; align-items:flex-end; }
.msg-bubble-wrap.me { flex-direction:row-reverse; }
.msg-av { width:30px; height:30px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.msg-bubble { padding:10px 14px; border-radius:16px; font-size:13px; line-height:1.5; max-width:420px; position:relative; }
.msg-bubble.other { background:#fff; color:var(--cn); border:1.5px solid var(--cbr); border-bottom-left-radius:4px; box-shadow:var(--sh); }
.msg-bubble.me { background:linear-gradient(135deg,var(--cb),#0EA5A0); color:#fff; border-bottom-right-radius:4px; box-shadow:0 2px 8px rgba(27,79,158,.25); }
.msg-meta { font-size:10px; margin-top:4px; display:flex; align-items:center; gap:4px; }
.msg-meta.other { color:#9CA3AF; }
.msg-meta.me { color:rgba(255,255,255,.65); justify-content:flex-end; }
.msg-status { font-size:12px; }
.msg-date-sep { text-align:center; font-size:10.5px; color:var(--cm); font-weight:600; margin:10px 0; }
.msg-date-sep span { background:#EEF4FF; padding:4px 14px; border-radius:99px; border:1px solid var(--cbr); }

/* Attachment bubble */
.msg-attachment { display:flex; align-items:center; gap:10px; background:#F0F5FF; border:1.5px solid var(--cbr); border-radius:12px; padding:10px 14px; cursor:pointer; transition:background .2s; max-width:280px; }
.msg-attachment:hover { background:#EEF4FF; }
.msg-attachment.me { background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.3); }

/* Input area */
.msg-input-area { padding:14px 20px; border-top:1.5px solid var(--cbr); background:#fff; flex-shrink:0; }
.msg-input-row { display:flex; align-items:flex-end; gap:10px; }
.msg-input-wrap { flex:1; background:#F8FAFD; border:1.5px solid var(--cbr); border-radius:14px; padding:10px 14px; display:flex; flex-direction:column; gap:6px; transition:border-color .2s; }
.msg-input-wrap:focus-within { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.1); }
.msg-textarea { width:100%; border:none; background:transparent; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; resize:none; outline:none; min-height:20px; max-height:100px; line-height:1.5; }
.msg-input-tools { display:flex; align-items:center; gap:4px; }
.msg-tool-btn { width:30px; height:30px; border-radius:8px; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); transition:all .2s; }
.msg-tool-btn:hover { background:#EEF4FF; color:var(--cn); }
.msg-send-btn { width:42px; height:42px; border-radius:12px; border:none; background:linear-gradient(135deg,var(--cb),var(--ct)); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#fff; transition:all .2s; flex-shrink:0; }
.msg-send-btn:hover { transform:scale(1.05); box-shadow:0 4px 12px rgba(27,79,158,.35); }
.msg-send-btn:disabled { opacity:.4; transform:none; cursor:not-allowed; }

/* Reaction picker */
.reactions { display:flex; gap:4px; margin-top:4px; }
.react-pill { background:#F3F7FF; border:1px solid var(--cbr); border-radius:99px; padding:2px 8px; font-size:12px; cursor:pointer; transition:all .2s; }
.react-pill:hover { background:#EEF4FF; transform:scale(1.1); }

/* Card styles */
.adm-card { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; box-shadow:var(--sh); overflow:hidden; transition:box-shadow .2s; }
.adm-card:hover { box-shadow:var(--shm); }
.adm-card-hdr { padding:14px 20px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:linear-gradient(to right,rgba(238,244,255,.6),transparent); }
.adm-card-hdr h3 { font-size:14px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:8px; }

/* KPI */
.msg-kpi { background:#fff; border:1.5px solid var(--cbr); border-radius:18px; padding:18px 20px; box-shadow:var(--sh); position:relative; overflow:hidden; }
.msg-kpi::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; border-radius:18px 18px 0 0; }
.msg-kpi.blue::before   { background:var(--cb); }
.msg-kpi.teal::before   { background:var(--ct); }
.msg-kpi.orange::before { background:var(--co); }
.msg-kpi.green::before  { background:var(--cg); }
.msg-kpi.red::before    { background:var(--cr); }
.msg-kpi.purple::before { background:var(--cp); }

/* Badges */
.cbdg { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; white-space:nowrap; }
.cbdg.red    { background:#FEF2F2; color:var(--cr); border:1px solid #FECACA; }
.cbdg.orange { background:#FFF7ED; color:var(--co); border:1px solid #FED7AA; }
.cbdg.green  { background:#ECFDF5; color:var(--cg); border:1px solid #A7F3D0; }
.cbdg.blue   { background:#EFF6FF; color:var(--cb); border:1px solid #BFDBFE; }
.cbdg.teal   { background:#F0FDFC; color:var(--ct); border:1px solid #99F6E4; }
.cbdg.purple { background:#F5F3FF; color:var(--cp); border:1px solid #DDD6FE; }
.cbdg.gray   { background:#F9FAFB; color:#4B5563;   border:1px solid #E5E7EB; }

/* Buttons */
.cbtn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; border:none; transition:all .2s; font-family:'Poppins',sans-serif; }
.cbtn-primary { background:var(--cb); color:#fff; } .cbtn-primary:hover { background:#174391; }
.cbtn-teal    { background:var(--ct); color:#fff; } .cbtn-teal:hover    { background:var(--ct2); }
.cbtn-ghost   { background:transparent; color:var(--cm); border:1.5px solid var(--cbr); }
.cbtn-ghost:hover { background:var(--cl); color:var(--cn); }
.cbtn-danger  { background:#FEF2F2; color:var(--cr); border:1.5px solid #FECACA; }
.cbtn-sm { padding:6px 12px; font-size:12px; }

/* Forms */
.clbl { font-size:12px; font-weight:600; color:var(--cm); margin-bottom:6px; display:block; }
.cinp { width:100%; padding:9px 13px; border-radius:10px; border:1.5px solid var(--cbr); background:#FAFBFF; font-size:13px; color:var(--cn); font-family:'Poppins',sans-serif; transition:border-color .2s; outline:none; }
.cinp:focus { border-color:var(--ct); box-shadow:0 0 0 3px rgba(14,165,160,.12); }

/* Modal */
.mov { position:fixed; inset:0; z-index:500; background:rgba(11,30,59,.55); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:20px; }
.mov-box { background:#fff; border-radius:20px; box-shadow:var(--shl); width:100%; max-width:580px; max-height:90vh; overflow-y:auto; animation:slideUp .25s ease; }
@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
.mov-hdr { padding:18px 24px; border-bottom:1.5px solid var(--cbr); display:flex; align-items:center; justify-content:space-between; background:#EEF4FF; position:sticky; top:0; z-index:2; border-radius:20px 20px 0 0; }
.mov-hdr h3 { font-size:16px; font-weight:700; color:var(--cn); margin:0; display:flex; align-items:center; gap:10px; }
.mov-cls { width:32px; height:32px; border-radius:8px; background:#F3F7FF; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); font-size:18px; transition:all .2s; font-family:'Poppins',sans-serif; }
.mov-cls:hover { background:#FEF2F2; color:var(--cr); }
.mov-body { padding:24px; }

/* Notification items */
.notif-item { display:flex; gap:12px; padding:14px 20px; border-bottom:1px solid #F3F7FF; cursor:pointer; transition:background .15s; }
.notif-item:hover { background:#F8FAFF; }
.notif-item.unread { background:#EEF4FF; border-left:3px solid var(--ct); }
.notif-dot { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }

/* Group member */
.grp-member { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #F3F7FF; }

/* Typing indicator */
@keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }
.typing-dot { width:7px; height:7px; background:var(--cm); border-radius:50%; animation:bounce 1.4s infinite ease-in-out; display:inline-block; }
.typing-dot:nth-child(1){animation-delay:-.32s} .typing-dot:nth-child(2){animation-delay:-.16s}

/* Fade */
@keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
.fu { animation:fadeUp .3s ease both; }

/* ─ Enregistrement vocal ─ */
.msg-rec-wrap { flex:1; background:#FEF2F2; border:1.5px solid #FCA5A5; border-radius:14px; padding:10px 16px; display:flex; align-items:center; gap:12px; }
.msg-rec-dot { width:10px; height:10px; border-radius:50%; background:#DC2626; animation:recBlink 1s infinite; flex-shrink:0; }
@keyframes recBlink { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
.msg-rec-timer { font-size:15px; font-weight:700; color:#DC2626; font-variant-numeric:tabular-nums; min-width:36px; }
.msg-rec-label { font-size:12px; color:#B91C1C; font-weight:500; flex:1; }
.msg-rec-wave { display:flex; align-items:center; gap:2px; }
.msg-rec-wave span { width:3px; border-radius:99px; background:#DC2626; animation:wave 1.2s infinite ease-in-out; }
.msg-rec-wave span:nth-child(1){ height:8px; animation-delay:0s; }
.msg-rec-wave span:nth-child(2){ height:14px; animation-delay:.15s; }
.msg-rec-wave span:nth-child(3){ height:20px; animation-delay:.3s; }
.msg-rec-wave span:nth-child(4){ height:14px; animation-delay:.45s; }
.msg-rec-wave span:nth-child(5){ height:8px; animation-delay:.6s; }
@keyframes wave { 0%,100%{transform:scaleY(.4)} 50%{transform:scaleY(1)} }
.msg-mic-btn { width:42px; height:42px; border-radius:12px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--cm); background:#F8FAFD; border:1.5px solid var(--cbr); transition:all .2s; flex-shrink:0; }
.msg-mic-btn:hover { background:#EEF4FF; color:var(--ct); border-color:var(--ct); }
.msg-mic-btn.recording { background:linear-gradient(135deg,#DC2626,#EF4444); color:#fff; border-color:transparent; box-shadow:0 0 0 0 rgba(220,38,38,.4); animation:micPulse 1.4s infinite; }
@keyframes micPulse { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.35)} 60%{box-shadow:0 0 0 10px rgba(220,38,38,0)} }
.msg-rec-stop { width:38px; height:38px; border-radius:10px; border:1.5px solid #FCA5A5; background:#fff; color:#DC2626; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:700; flex-shrink:0; transition:all .2s; }
.msg-rec-stop:hover { background:#DC2626; color:#fff; border-color:#DC2626; }
.msg-rec-send { width:38px; height:38px; border-radius:10px; border:none; background:linear-gradient(135deg,#059669,#10B981); color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
.msg-rec-send:hover { transform:scale(1.07); box-shadow:0 4px 12px rgba(5,150,105,.35); }

/* ─ Bulle audio ─ */
.msg-audio-bubble { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:16px; width:270px; }
.msg-audio-bubble.other { background:#fff; border:1.5px solid var(--cbr); box-shadow:var(--sh); border-bottom-left-radius:4px; }
.msg-audio-bubble.me { background:linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.08)); border:1.5px solid rgba(255,255,255,.2); border-bottom-right-radius:4px; }
.msg-audio-play { width:40px; height:40px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
.msg-audio-play.other { background:#EEF4FF; color:var(--cb); }
.msg-audio-play.me    { background:rgba(255,255,255,.28); color:#fff; }
.msg-audio-play:hover { transform:scale(1.08); box-shadow:0 3px 10px rgba(0,0,0,.18); }
.msg-audio-track { height:4px; border-radius:99px; cursor:pointer; position:relative; }
.msg-audio-track.other { background:#DDE6F5; }
.msg-audio-track.me    { background:rgba(255,255,255,.2); }
.msg-audio-fill { position:absolute; left:0; top:0; height:100%; border-radius:99px; }
.msg-audio-fill.other { background:var(--cb); }
.msg-audio-fill.me    { background:rgba(255,255,255,.9); }
.msg-audio-knob { position:absolute; top:50%; transform:translateY(-50%); width:10px; height:10px; border-radius:50%; margin-left:-5px; }
.msg-audio-knob.other { background:var(--cb); }
.msg-audio-knob.me    { background:#fff; }

/* ─ Actions sur message (hover) ─ */
.msg-hover-actions { position:absolute; display:flex; gap:3px; background:#fff; border:1.5px solid var(--cbr); border-radius:10px; padding:4px 6px; box-shadow:0 4px 16px rgba(11,30,59,.12); z-index:20; top:-34px; opacity:0; pointer-events:none; transition:opacity .15s; }
.msg-wrap:hover .msg-hover-actions { opacity:1; pointer-events:auto; }
.msg-hover-actions.me { right:0; }
.msg-hover-actions.other { left:38px; }
.mha-btn { width:24px; height:24px; border-radius:6px; border:none; background:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; transition:background .15s; }
.mha-btn:hover { background:#F3F7FF; }
.mha-btn.del:hover { background:#FEF2F2; }

/* Empty state */
.msg-empty { flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:14px; color:var(--cm); }

/* Table */
.adm-tbl { width:100%; border-collapse:collapse; }
.adm-tbl thead tr { background:linear-gradient(to right,#F8FAFD,#EEF4FF); }
.adm-tbl th { padding:11px 14px; text-align:left; font-size:11px; font-weight:700; color:var(--cm); text-transform:uppercase; letter-spacing:.6px; border-bottom:1.5px solid var(--cbr); }
.adm-tbl td { padding:11px 14px; font-size:13px; border-bottom:1px solid #F3F7FF; vertical-align:middle; }
.adm-tbl tbody tr:last-child td { border-bottom:none; }
.adm-tbl tbody tr:hover { background:#F8FAFF; }

/* ─── Responsive ─── */
.msg-g2  { display:grid; grid-template-columns:2fr 1fr; gap:20px; }
.msg-g11 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
@media (max-width:767px) {
  .msg-top { padding:12px 14px 0; }
  .msg-g2,.msg-g11 { grid-template-columns:1fr; gap:14px; }
  .cinp { font-size:16px !important; }
  .cbtn { font-size:12px; padding:8px 12px; } .cbtn-sm { font-size:11px; padding:5px 8px; }
  .adm-card { border-radius:14px; }
  .mov { padding:0; align-items:flex-end; } .mov-box { border-radius:20px 20px 0 0; max-width:100%; max-height:93vh; }
  .mov-hdr { padding:13px 16px; } .mov-body { padding:14px; }
}
@media (max-width:599px) {
  .msg-layout { grid-template-columns:1fr !important; height:calc(100vh - 155px); }
  .msg-chat-hdr { padding:10px 12px; }
  .msg-chat-actions .cbtn { padding:5px 8px; font-size:11px; }
  .msg-input-area { padding:10px 12px; }
  .msg-hint { display:none !important; }
  .msg-bubble { max-width:78vw; }
  .msg-area { padding:12px 10px; }
  .msg-back-btn { display:inline-flex !important; }
}
@media (max-width:479px) { .msg-top { padding:10px 12px 0; } }
.msg-back-btn { display:none; align-items:center; gap:5px; padding:6px 10px; border-radius:8px; border:1.5px solid var(--cbr); background:#EEF4FF; color:var(--cn); font-size:12px; font-weight:600; cursor:pointer; font-family:'Poppins',sans-serif; flex-shrink:0; }
`;

// ─── Icons ────────────────────────────────────────────────────
const I = {
  chat:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  send:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  attach: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  image:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  file:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  emoji:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  mic:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>,
  stop:   <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
  play:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  info:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  star:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  archive:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  trash:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  users:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  bell:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  check2: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  dbl:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/><polyline points="20 11 9 22 4 17"/></svg>,
  dl:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  forward:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 014-4h12"/></svg>,
};

// ─── Helpers ─────────────────────────────────────────────────
const fmtTime = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const now = new Date();
  const diff = (now - dt) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `${Math.floor(diff/60)} min`;
  if (diff < 86400) return dt.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
  return dt.toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit" });
};
const fmtFull = (d) => d ? new Date(d).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
const isSameDay = (d1, d2) => {
  const a = new Date(d1), b = new Date(d2);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};
const fmtDay = (d) => {
  const dt = new Date(d);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(dt, today)) return "Aujourd'hui";
  if (isSameDay(dt, yesterday)) return "Hier";
  return dt.toLocaleDateString("fr-FR", { weekday:"long", day:"2-digit", month:"long" });
};

// ─── Role config ──────────────────────────────────────────────
const ROLE_CFG = {
  superadmin:     { icon:"👑", cls:"red",    label:"Super Admin",    color:"#DC2626" },
  adminclinique:  { icon:"🏥", cls:"purple", label:"Administrateur", color:"#7C3AED" },
  medecin:        { icon:"👨‍⚕️", cls:"blue",   label:"Médecin",        color:"#1B4F9E" },
  infirmier:      { icon:"💉", cls:"teal",   label:"Infirmier",      color:"#0EA5A0" },
  sage_femme:     { icon:"🤰", cls:"pink",   label:"Sage-femme",     color:"#EC4899" },
  radiologue:     { icon:"🩻", cls:"cyan",   label:"Radiologue",     color:"#0891B2" },
  pharmacien:     { icon:"💊", cls:"green",  label:"Pharmacien",     color:"#059669" },
  laborantin:     { icon:"🔬", cls:"orange", label:"Laborantin",     color:"#D97706" },
  comptable:      { icon:"💰", cls:"gray",   label:"Comptable",      color:"#6B7280" },
  receptionniste: { icon:"📋", cls:"gray",   label:"Réceptionniste", color:"#6B7280" },
};
const getRoleIcon = (role) => ROLE_CFG[role]?.icon || "👤";
const getRoleCls  = (role) => ROLE_CFG[role]?.cls  || "gray";
const getRoleLbl  = (role) => ROLE_CFG[role]?.label || role;
const AV_COLORS = ["#1B4F9E","#0EA5A0","#7C3AED","#DC2626","#D97706","#059669","#4F46E5","#0B1E3B"];

// AUDIT-MESSAGES-PhaseB — le bouton Emoji n'avait aucun onClick. Sélecteur
// réel (pas de nouvelle dépendance) : insère l'emoji choisi dans le champ
// de saisie.
const EMOJI_LIST = ["😀","😂","🙂","😉","😍","😢","😮","😡","👍","👎","🙏","👏","🎉","❤️","🔥","✅","❌","⚠️","⏰","💊","🩺","📋","🚑","🤔"];

// ─── Helpers conversation (AUDIT-MESSAGES-PhaseA) ──────────────
// Le backend (models/Conversation.js) renvoie type:'direct'|'groupe' et un
// tableau membres[] (jamais un champ singulier "membre") ; pour un groupe,
// nom/description/membres sont des champs directs de la conversation, pas
// un sous-objet "groupe". Ces helpers centralisent la lecture correcte de
// cette forme réelle, à la place des accès conv.membre / conv.groupe /
// type==="group" qui ne matchaient jamais aucune donnée réelle.
const isGroupConv = (conv) => conv?.type === "groupe";
const getOtherMember = (conv, meId) => (conv?.membres || []).find(m => (m?._id || m) !== meId) || null;
const getConvDisplayName = (conv, meId) => {
  if (isGroupConv(conv)) return conv?.nom || "Groupe";
  const c = getOtherMember(conv, meId);
  return c ? `${c.prenom || ""} ${c.nom || ""}`.trim() : "—";
};

// ─── Demo data ────────────────────────────────────────────────
const DEMO_USERS = [];

const buildDemoConvs = (userId) => [];

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 580 }) {
  const boxRef = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  useEffect(() => {
    if (open) boxRef.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="mov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={boxRef} className="mov-box" style={{ maxWidth }} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="mov-hdr">
          <h3 id={titleId}>{title}</h3>
          <button className="mov-cls" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="mov-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────
function Av({ user, size = 42, idx = 0, showStatus = false }) {
  const col = AV_COLORS[idx % AV_COLORS.length];
  const statusCol = { online:"#059669", away:"#D97706", offline:"#9CA3AF" }[user?.statut_ligne || "offline"];
  return (
    <div className="conv-av" style={{ width:size, height:size, background:`${col}18`, borderRadius: size > 36 ? 12 : 9, flexShrink:0 }}>
      <span style={{ fontSize: size > 36 ? 20 : 16 }}>{getRoleIcon(user?.role)}</span>
      {showStatus && (
        <div className="conv-av-status" style={{ background: statusCol }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function Messagerie() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const { user: authUser } = useAuth() || {};
  const me = authUser || { _id:"me", prenom:"Moi", nom:"", role:"medecin" };
  const { socket } = useSocket();

  const [tab, setTab]               = useState("inbox");
  const [filter, setFilter]         = useState("tous");
  const [search, setSearch]         = useState("");
  const [convs, setConvs]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [messagesError, setMessagesError] = useState(false);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [showInfo, setShowInfo]     = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const [showNewGrp, setShowNewGrp] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [newGrpForm, setNewGrpForm] = useState({ nom:"", membres:[], description:"" });

  // AUDIT-MESSAGES-PhaseC — les 4 "actions rapides" du panneau info
  // (partager résultat labo/imagerie/dossier, envoyer ordonnance)
  // affichaient un faux succès sans rien envoyer. Réutilise la brique
  // d'upload de pièce jointe de la Phase B : le document réel du patient
  // (généré en PDF côté client pour labo/dossier/ordonnance, ou le fichier
  // d'imagerie déjà stocké tel quel) est envoyé comme une vraie pièce
  // jointe via sendFileAttachment, sans nouvel endpoint backend.
  const [shareType, setShareType]           = useState(null); // 'labo' | 'imagerie' | 'dossier' | 'ordonnance'
  const [shareStep, setShareStep]           = useState("patient"); // 'patient' | 'record' | 'confirm'
  const [shareQuery, setShareQuery]         = useState("");
  const [sharePatients, setSharePatients]   = useState([]);
  const [sharePatient, setSharePatient]     = useState(null);
  const [shareRecords, setShareRecords]     = useState([]);
  const [shareRecord, setShareRecord]       = useState(null);
  const [shareImage, setShareImage]         = useState(null);
  const [shareRecordsLoading, setShareRecordsLoading] = useState(false);
  const [shareSending, setShareSending]     = useState(false);

  const bottomRef     = useRef(null);
  const textRef       = useRef(null);
  const fileInputRef  = useRef(null);
  const pendingAttachTypeRef = useRef("document");
  const mediaRecRef   = useRef(null);
  const recTimerRef   = useRef(null);
  const audioChunksRef= useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds,  setRecSeconds]  = useState(0);
  const [playingId,   setPlayingId]   = useState(null);
  const [audioProgress, setAudioProgress] = useState({});
  const currentAudioRef = useRef(null);

  // ── Load convs ────────────────────────────────────────────
  const loadConvs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/messages");
      setConvs(data.conversations || data || []);
    } catch {
      setConvs(buildDemoConvs(me._id));
    } finally { setLoading(false); }
  }, [me._id]);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/messages/directory");
      setUsers(data.users || data || []);
    } catch { setUsers(DEMO_USERS); }
  }, []);

  // AUDIT-MESSAGES-PhaseC — l'onglet Notifications affichait DEMO_NOTIFS (un
  // tableau vide, jamais peuplé) : "Aucune notification" en permanence, quel
  // que soit l'état réel du compte. Branché sur GET /api/notifications, déjà
  // utilisé par d'autres modules (labo, radiologie, hospitalisation...) pour
  // créer de vraies notifications, mais jamais consommé ici.
  const loadNotifs = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data.notifications || []);
    } catch { /* silencieux — l'onglet affichera "Aucune notification" */ }
  }, []);

  useEffect(() => { loadConvs(); loadUsers(); loadNotifs(); }, [loadConvs, loadUsers, loadNotifs]);

  // ── Socket.IO : réception des messages en temps réel ─────
  const selectedRef = useRef(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = ({ conversationId, message }) => {
      const current = selectedRef.current;

      // Si la conversation active reçoit un nouveau message
      if (current && current._id === conversationId) {
        setMessages(prev => {
          // Doublon exact (même _id) — déjà présent
          if (prev.some(m => m._id === message._id)) return prev;
          // Message de nous-mêmes : le tmp_ est déjà dans la liste (optimistic update).
          // On remplace le tmp correspondant (même contenu, envoyé très récemment).
          if (message.expediteur?._id === me._id) {
            const tmpIdx = prev.findIndex(m =>
              m._id.startsWith('tmp_') && m.contenu === message.contenu
            );
            if (tmpIdx !== -1) {
              return prev.map((m, i) => i === tmpIdx ? { ...m, ...message } : m);
            }
            // Pas de tmp correspondant (ex: autre appareil) → on ajoute normalement
          }
          return [...prev, message];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
      } else {
        // Badge non-lu sur la conversation non ouverte
        setConvs(prev => prev.map(c =>
          c._id === conversationId
            ? { ...c, non_lus: (c.non_lus || 0) + 1, dernier_message_apercu: message.contenu, dernier_message: message.date_envoi }
            : c
        ));
        toast('💬 Nouveau message', { duration: 2500 });
      }

      // Rafraîchir la liste des conversations
      loadConvs();
    };

    // AUDIT-07 — réactions et suppressions émises par le backend (emitTo,
    // même canal que message:new) : les autres membres de la conversation
    // ouverte doivent les recevoir sans recharger la page.
    const handleReaction = ({ conversationId, msgId, reactions }) => {
      if (selectedRef.current?._id !== conversationId) return;
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, reactions } : m));
    };
    const handleDeleted = ({ conversationId, msgId }) => {
      if (selectedRef.current?._id !== conversationId) return;
      setMessages(prev => prev.filter(m => m._id !== msgId));
    };

    socket.on('message:new', handleNewMsg);
    socket.on('message:reaction', handleReaction);
    socket.on('message:deleted', handleDeleted);
    return () => {
      socket.off('message:new', handleNewMsg);
      socket.off('message:reaction', handleReaction);
      socket.off('message:deleted', handleDeleted);
    };
  }, [socket, loadConvs, me._id]);

  // ── Open conversation ─────────────────────────────────────
  const openConv = async (conv) => {
    // Quitter la room précédente et rejoindre la nouvelle
    if (socket) {
      if (selected) socket.emit('leave:conversation', selected._id);
      socket.emit('join:conversation', conv._id);
    }
    setSelected(conv);
    setShowInfo(false);
    setMessagesError(false);
    try {
      const { data } = await api.get(`/messages/${conv._id}`);
      setMessages(data.messages || []);
    } catch {
      // AUDIT-MESSAGES-PhaseC — un échec de chargement affichait buildDemoMessages
      // (des messages fabriqués, indiscernables d'une vraie conversation) : même
      // problème que les faux succès déjà corrigés ailleurs dans ce module.
      // État d'erreur explicite à la place, aucun contenu fictif.
      setMessages([]);
      setMessagesError(true);
    }
    // Mark as read
    setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, non_lus: 0 } : c));
  };

  const retryLoadMessages = () => { if (selected) openConv(selected); };

  // ── Start new conv ────────────────────────────────────────
  const startConv = async (userId) => {
    const u = users.find(u => u._id === userId);
    const existing = convs.find(c => c.type === "direct" && getOtherMember(c, me._id)?._id === userId);
    if (existing) { openConv(existing); return; }
    const fakeConv = { _id:`c_${Date.now()}`, type:"direct", membres:[me, u], dernier_message_apercu:"", dernier_message: new Date().toISOString(), non_lus:0, favori:false };
    try {
      const { data } = await api.post("/messages", { userId });
      const conv = data.conversation || fakeConv;
      setConvs(prev => [conv, ...prev]);
      openConv(conv);
    } catch {
      setConvs(prev => [fakeConv, ...prev]);
      openConv(fakeConv);
      setMessages([]);
    }
  };

  // ── Send message ──────────────────────────────────────────
  const sendMsg = async (e) => {
    e?.preventDefault();
    if (!input.trim() || !selected) return;
    const txt = input.trim();
    setInput("");
    if (textRef.current) textRef.current.style.height = "20px";
    setSending(true);
    const tmpMsg = { _id:`tmp_${Date.now()}`, contenu:txt, expediteur:{ _id:me._id, prenom:me.prenom, nom:me.nom, role:me.role }, date_envoi:new Date().toISOString(), lu:false, reactions:[] };
    setMessages(m => [...m, tmpMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    try {
      const { data } = await api.post(`/messages/${selected._id}/send`, { contenu: txt });
      const real = data.message;
      if (real) {
        setMessages(m => {
          // Si le socket a déjà remplacé le tmp (race condition) → on retire juste le tmp restant
          if (m.some(msg => msg._id === real._id)) {
            return m.filter(msg => msg._id !== tmpMsg._id);
          }
          // Sinon on remplace le tmp par le vrai message
          return m.map(msg => msg._id === tmpMsg._id ? { ...tmpMsg, ...real } : msg);
        });
      }
      setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, dernier_message_apercu:txt, dernier_message: new Date().toISOString() } : c));
    } catch {
      // AUDIT-3.3 — le message optimiste restait affiché comme envoyé avec
      // succès même si l'appel réseau échouait (catch vide), sans aucune
      // indication ni possibilité de renvoi — perte de communication
      // silencieuse. Marqué en échec visible (voir rendu de la bulle),
      // renvoi possible via retrySendMsg(). L'aperçu de conversation n'est
      // plus mis à jour non plus quand l'envoi échoue réellement.
      setMessages(m => m.map(msg => msg._id === tmpMsg._id ? { ...msg, echec: true } : msg));
    }
    setSending(false);
  };

  // Renvoi d'un message resté en échec (AUDIT-3.3).
  const retrySendMsg = async (msg) => {
    if (!selected) return;
    setMessages(m => m.map(mm => mm._id === msg._id ? { ...mm, echec: false, envoiEnCours: true } : mm));
    try {
      const { data } = await api.post(`/messages/${selected._id}/send`, { contenu: msg.contenu });
      const real = data.message;
      setMessages(m => m.map(mm => mm._id === msg._id ? (real ? { ...mm, ...real, envoiEnCours: false } : { ...mm, envoiEnCours: false }) : mm));
      setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, dernier_message_apercu: msg.contenu, dernier_message: new Date().toISOString() } : c));
    } catch {
      setMessages(m => m.map(mm => mm._id === msg._id ? { ...mm, echec: true, envoiEnCours: false } : mm));
    }
  };

  // ── Create group ──────────────────────────────────────────
  const createGroup = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/messages/groups", newGrpForm);
      setConvs(prev => [data.conversation, ...prev]);
      toast.success("✅ Groupe créé");
      setShowNewGrp(false);
      setNewGrpForm({ nom:"", membres:[], description:"" });
    } catch {
      toast.error("Erreur lors de la création du groupe.");
    }
  };

  // ── Toggle reaction ───────────────────────────────────────
  // AUDIT-07 — plus d'optimisme silencieux : l'état local n'est mis à jour
  // qu'avec la réponse réelle du serveur (source de vérité), jamais avant.
  // En cas d'échec, rien n'a été modifié localement — pas de fausse réussite
  // à annuler, et une erreur est affichée.
  const toggleReaction = async (msgId, emoji) => {
    try {
      const { data } = await api.post(`/messages/reactions/${msgId}`, { emoji });
      setMessages(prev => prev.map(m => m._id === msgId ? { ...m, reactions: data.reactions } : m));
    } catch {
      toast.error("Impossible d'ajouter la réaction.");
    }
  };

  // AUDIT-MESSAGES-PhaseB — favoris/archiver étaient purement locaux (état
  // React, jamais persisté, perdu au rafraîchissement). Appelle maintenant
  // les vrais endpoints ; l'état local n'est mis à jour qu'avec la vraie
  // réponse serveur (jamais avant), même principe que toggleReaction.
  const toggleFavoriConv = async (conv) => {
    try {
      const { data } = await api.put(`/messages/${conv._id}/favori`);
      setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, favori: data.favori } : c));
      setSelected(s => s && s._id === conv._id ? { ...s, favori: data.favori } : s);
      toast.success(data.favori ? "⭐ Ajouté aux favoris" : "Retiré des favoris");
    } catch {
      toast.error("Impossible de mettre à jour les favoris.");
    }
  };

  const toggleArchiveConv = async (conv) => {
    try {
      const { data } = await api.put(`/messages/${conv._id}/archiver`);
      setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, archivee: data.archivee } : c));
      if (data.archivee) setSelected(null);
      toast.success(data.archivee ? "📦 Conversation archivée" : "Conversation restaurée");
    } catch {
      toast.error("Impossible d'archiver la conversation.");
    }
  };

  // AUDIT-MESSAGES-PhaseB — "Transférer" affichait un faux succès (toast
  // seul). Réutilise le vrai endpoint d'envoi ; pour une pièce jointe, ne
  // transmet qu'une référence au fichier déjà stocké (le backend valide que
  // le chemin reste dans /uploads/messages/), aucun re-upload.
  const forwardMessage = async (targetConvId) => {
    if (!forwardMsg) return;
    try {
      const body = forwardMsg.pieceJointe
        ? { contenu: "", pieceJointe: {
            filename: forwardMsg.pieceJointe.filename,
            path: forwardMsg.pieceJointe.path,
            type: forwardMsg.pieceJointe.type,
            duration: forwardMsg.pieceJointe.duration,
          } }
        : { contenu: forwardMsg.contenu };
      await api.post(`/messages/${targetConvId}/send`, body);
      toast.success("↪️ Message transféré");
      setForwardMsg(null);
      if (selected?._id === targetConvId) openConv(selected);
      loadConvs();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Échec du transfert.");
    }
  };

  // ── Mark notif read ───────────────────────────────────────
  const readNotif = async (id) => {
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, lu:true } : n));
    try { await api.put(`/notifications/${id}/read`); } catch { /* déjà mis à jour localement, non bloquant */ }
  };

  const readAllNotifs = async () => {
    setNotifs(prev => prev.map(n => ({ ...n, lu:true })));
    try { await api.put("/notifications/read-all"); } catch { toast.error("Échec de la mise à jour."); }
  };

  // ── Keyboard: Enter sends, Shift+Enter = newline ──────────
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  // ── Auto-resize textarea ──────────────────────────────────
  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "20px";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  // ── Voice message ─────────────────────────────────────────
  const startVoice = async () => {
    if (!selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(100);
      mediaRecRef.current = mr;
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      toast.error("Microphone non accessible. Vérifiez les permissions.");
    }
  };

  // AUDIT-MESSAGES-PhaseB — bug n°3 : l'enregistrement était réel (micro,
  // MediaRecorder) mais rien n'était jamais envoyé au serveur (blob local +
  // faux succès). Envoie maintenant réellement le fichier via l'endpoint
  // d'upload commun (POST /messages/:id/attachment), avec mise à jour
  // optimiste identique au texte (tmp_ remplacé par le vrai message via le
  // même canal Socket.IO message:new que sendMsg).
  const stopVoice = (send = false) => {
    const mr = mediaRecRef.current;
    if (!mr) return;
    mr.onstop = async () => {
      mr.stream?.getTracks().forEach(t => t.stop());
      if (send && audioChunksRef.current.length > 0 && selected) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const dur  = recSeconds;
        const localUrl = URL.createObjectURL(blob);
        const tmpId = `tmp_${Date.now()}`;
        const tmpMsg = {
          _id: tmpId, pieceJointe: { type:"audio", path: localUrl, duration: dur },
          expediteur: { _id: me._id, prenom: me.prenom, nom: me.nom, role: me.role },
          date_envoi: new Date().toISOString(), lu: false, reactions: [], envoiEnCours: true,
        };
        setMessages(m => [...m, tmpMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
        try {
          const form = new FormData();
          form.append("fichier", blob, "vocal.webm");
          form.append("type", "audio");
          form.append("duration", String(dur));
          const { data } = await api.post(`/messages/${selected._id}/attachment`, form, { headers: { "Content-Type": "multipart/form-data" } });
          setMessages(m => {
            if (m.some(msg => msg._id === data.message._id)) return m.filter(msg => msg._id !== tmpId);
            return m.map(msg => msg._id === tmpId ? { ...data.message } : msg);
          });
          setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, dernier_message_apercu:"🎙️ Message vocal", dernier_message: new Date().toISOString() } : c));
          toast.success(`🎙️ Message vocal envoyé (${dur}s)`);
        } catch (err) {
          setMessages(m => m.map(msg => msg._id === tmpId ? { ...msg, echec: true, envoiEnCours: false } : msg));
          toast.error(err?.response?.data?.message || "Échec de l'envoi du message vocal.");
        }
      }
      audioChunksRef.current = [];
    };
    mr.stop();
    mediaRecRef.current = null;
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    setRecSeconds(0);
  };

  const fmtRecTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // AUDIT-MESSAGES-PhaseB — "Pièce jointe"/"Image"/"Document médical"
  // affichaient un faux succès (toast seul, aucun sélecteur de fichier).
  // Réutilise le même endpoint d'upload que le message vocal ci-dessus.
  const triggerFilePicker = (type) => {
    if (!selected) return;
    pendingAttachTypeRef.current = type;
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === "image" ? "image/*" : type === "document" ? ".pdf,.doc,.docx,.xls,.xlsx" : "*/*";
      fileInputRef.current.click();
    }
  };

  const sendFileAttachment = async (file, type) => {
    if (!selected) return;
    const localUrl = type === "image" ? URL.createObjectURL(file) : null;
    const tmpId = `tmp_${Date.now()}`;
    const tmpMsg = {
      _id: tmpId, pieceJointe: { type, path: localUrl, filename: file.name },
      expediteur: { _id: me._id, prenom: me.prenom, nom: me.nom, role: me.role },
      date_envoi: new Date().toISOString(), lu: false, reactions: [], envoiEnCours: true,
    };
    setMessages(m => [...m, tmpMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:"smooth" }), 50);
    const apercu = { image: "🖼️ Image", document: "📄 Document" }[type] || "📎 Pièce jointe";
    try {
      const form = new FormData();
      form.append("fichier", file, file.name);
      form.append("type", type);
      const { data } = await api.post(`/messages/${selected._id}/attachment`, form, { headers: { "Content-Type": "multipart/form-data" } });
      setMessages(m => {
        if (m.some(msg => msg._id === data.message._id)) return m.filter(msg => msg._id !== tmpId);
        return m.map(msg => msg._id === tmpId ? { ...data.message } : msg);
      });
      setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, dernier_message_apercu: apercu, dernier_message: new Date().toISOString() } : c));
      toast.success(`${apercu} envoyé(e)`);
    } catch (err) {
      setMessages(m => m.map(msg => msg._id === tmpId ? { ...msg, echec: true, envoiEnCours: false } : msg));
      toast.error(err?.response?.data?.message || "Échec de l'envoi de la pièce jointe.");
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    sendFileAttachment(file, pendingAttachTypeRef.current);
  };

  // ── Partage de documents patient (panneau info) ────────────
  // AUDIT-MESSAGES-PhaseC — voir la note de commentaire près des états
  // share* : réutilise sendFileAttachment ci-dessus, donc le mécanisme de
  // stockage/diffusion est strictement identique aux pièces jointes déjà
  // envoyées en Phase B (mêmes contrôles d'accès, même endpoint).
  const SHARE_CFG = {
    labo:       { icon:"🔬", title:"Partager un résultat labo", endpoint:"/laboratory",    listKey:"results" },
    imagerie:   { icon:"🩻", title:"Partager imagerie",         endpoint:"/radiology",     listKey:"examens" },
    dossier:    { icon:"📋", title:"Partager dossier patient",  endpoint:null,             listKey:null },
    ordonnance: { icon:"💊", title:"Envoyer ordonnance",        endpoint:"/prescriptions", listKey:"prescriptions" },
  };

  const openShare = (type) => {
    setShareType(type);
    setShareStep("patient");
    setShareQuery("");
    setSharePatients([]);
    setSharePatient(null);
    setShareRecords([]);
    setShareRecord(null);
    setShareImage(null);
  };
  const closeShare = () => { setShareType(null); };

  // Recherche patient débouncée — même endpoint que les autres modules (GET /patients/search)
  useEffect(() => {
    if (!shareType || shareStep !== "patient" || shareQuery.trim().length < 2) { setSharePatients([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/patients/search?q=${encodeURIComponent(shareQuery.trim())}`);
        setSharePatients(data.patients || []);
      } catch { setSharePatients([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [shareQuery, shareType, shareStep]);

  const pickSharePatient = async (p) => {
    setSharePatient(p);
    if (shareType === "dossier") { setShareStep("confirm"); return; }
    setShareStep("record");
    setShareRecordsLoading(true);
    try {
      const cfg = SHARE_CFG[shareType];
      const { data } = await api.get(`${cfg.endpoint}?patient=${p._id}&limit=50`);
      setShareRecords(data[cfg.listKey] || []);
    } catch {
      toast.error("Impossible de charger les documents de ce patient.");
      setShareRecords([]);
    }
    setShareRecordsLoading(false);
  };

  const pdfHeader = (doc, title) => {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 30, 59); doc.rect(0, 0, W, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(`${title.toUpperCase()} — ${CLINIC_NAME.toUpperCase()}`, W / 2, 10, { align: "center" });
    doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
    doc.text(`${CLINIC_NAME} ${CLINIC_SUBTITLE} · Généré le ${new Date().toLocaleDateString("fr-FR")}`, W / 2, 17, { align: "center" });
    return W;
  };

  const buildLaboFile = (patient, r) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    pdfHeader(doc, "Résultat de laboratoire");
    const resultats = r.resultats && typeof r.resultats === "object"
      ? Object.entries(r.resultats).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v)])
      : [["Résultats", r.resultats != null ? String(r.resultats) : "—"]];
    autoTable(doc, {
      startY: 32, margin: { left: 14, right: 14 },
      body: [
        ["Patient", `${patient.prenom} ${patient.nom}`],
        ["N° dossier", patient.numero_dossier || "—"],
        ["Prescripteur", r.medecin_prescripteur_nom || "—"],
        ["Date de prescription", r.date_prescription ? new Date(r.date_prescription).toLocaleDateString("fr-FR") : "—"],
        ["Statut", r.statut || "—"],
        ["Critique", r.est_critique ? "Oui" : "Non"],
      ],
      theme: "grid", styles: { fontSize: 9.5 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [244, 247, 252], cellWidth: 50 } },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8, margin: { left: 14, right: 14 },
      head: [["Paramètre", "Valeur"]], body: resultats,
      theme: "grid", headStyles: { fillColor: [11, 30, 59] }, styles: { fontSize: 9 },
    });
    if (r.commentaires) {
      doc.setFontSize(9.5); doc.setTextColor(30, 30, 30);
      doc.text(`Commentaires : ${r.commentaires}`, 14, doc.lastAutoTable.finalY + 10, { maxWidth: doc.internal.pageSize.getWidth() - 28 });
    }
    const blob = doc.output("blob");
    return new File([blob], `resultat-labo-${patient.nom}-${r._id}.pdf`, { type: "application/pdf" });
  };

  const buildOrdonnanceFile = (patient, rx) => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    pdfHeader(doc, "Ordonnance");
    autoTable(doc, {
      startY: 32, margin: { left: 14, right: 14 },
      body: [
        ["N° ordonnance", rx.numero_rx || "—"],
        ["Patient", `${patient.prenom} ${patient.nom}`],
        ["N° dossier", patient.numero_dossier || "—"],
        ["Médecin", rx.medecin ? `${rx.medecin.prenom || ""} ${rx.medecin.nom || ""}`.trim() : "—"],
        ["Date de prescription", rx.date_prescription ? new Date(rx.date_prescription).toLocaleDateString("fr-FR") : "—"],
        ["Statut", rx.statut || "—"],
      ],
      theme: "grid", styles: { fontSize: 9.5 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [244, 247, 252], cellWidth: 50 } },
    });
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8, margin: { left: 14, right: 14 },
      head: [["Médicament", "Posologie", "Durée", "Qté", "Notes"]],
      body: (rx.lignes || []).map(l => [
        l.medicament_nom || l.medicament?.nom_commercial || l.medicament?.dci || "—",
        l.posologie || "—", l.duree || "—", l.quantite ?? "—", l.notes || "—",
      ]),
      theme: "grid", headStyles: { fillColor: [11, 30, 59] }, styles: { fontSize: 9 },
    });
    const blob = doc.output("blob");
    return new File([blob], `ordonnance-${rx.numero_rx || rx._id}.pdf`, { type: "application/pdf" });
  };

  const buildDossierFile = async (patientLite) => {
    const { data } = await api.get(`/patients/${patientLite._id}`);
    const p = data.patient;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    pdfHeader(doc, "Dossier patient");
    autoTable(doc, {
      startY: 32, margin: { left: 14, right: 14 },
      body: [
        ["Nom complet", `${p.prenom} ${p.nom}`],
        ["N° dossier", p.numero_dossier || "—"],
        ["Date de naissance", p.date_naissance ? new Date(p.date_naissance).toLocaleDateString("fr-FR") : "—"],
        ["Sexe", p.sexe || "—"],
        ["Téléphone", p.telephone || "—"],
        ["Groupe sanguin", p.groupe_sanguin || "—"],
        ["Allergies", (p.allergies || []).join(", ") || "—"],
        ["Antécédents médicaux", (p.antecedents_medicaux || []).join(", ") || "—"],
        ["Maladies chroniques", (p.maladies_chroniques || []).join(", ") || "—"],
        ["Médecin référent", p.medecin_referent ? `${p.medecin_referent.prenom || ""} ${p.medecin_referent.nom || ""}`.trim() : "—"],
        ["Statut", p.statut || "—"],
      ],
      theme: "grid", styles: { fontSize: 9.5 },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [244, 247, 252], cellWidth: 55 } },
    });
    const blob = doc.output("blob");
    return new File([blob], `dossier-${p.nom}-${p.numero_dossier || p._id}.pdf`, { type: "application/pdf" });
  };

  const confirmShare = async () => {
    if (!selected || !sharePatient) return;
    setShareSending(true);
    try {
      if (shareType === "dossier") {
        const file = await buildDossierFile(sharePatient);
        await sendFileAttachment(file, "document");
      } else if (shareType === "labo") {
        if (!shareRecord) throw new Error("Aucun résultat sélectionné.");
        await sendFileAttachment(buildLaboFile(sharePatient, shareRecord), "document");
      } else if (shareType === "ordonnance") {
        if (!shareRecord) throw new Error("Aucune ordonnance sélectionnée.");
        await sendFileAttachment(buildOrdonnanceFile(sharePatient, shareRecord), "document");
      } else if (shareType === "imagerie") {
        if (!shareImage) throw new Error("Aucune image sélectionnée.");
        const res = await fetch(shareImage.path, { credentials: "include" });
        if (!res.ok) throw new Error("Fichier d'imagerie introuvable.");
        const blob = await res.blob();
        const isImg = (shareImage.type_mime || "").startsWith("image/");
        const file = new File([blob], shareImage.filename || `imagerie-${shareRecord._id}`, { type: shareImage.type_mime || "application/octet-stream" });
        await sendFileAttachment(file, isImg ? "image" : "document");
      }
      closeShare();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Échec du partage du document.");
    }
    setShareSending(false);
  };

  // Sélection d'un enregistrement (résultat labo / ordonnance) dans la liste
  const pickShareRecord = (rec) => {
    setShareRecord(rec);
    setShareStep("confirm");
  };
  // Imagerie : un examen peut contenir plusieurs images réelles — on choisit l'examen puis l'image
  const pickShareExam = (exam) => {
    setShareRecord(exam);
    if ((exam.images || []).length === 1) {
      setShareImage(exam.images[0]);
      setShareStep("confirm");
    } else {
      setShareStep("image");
    }
  };
  const pickShareImage = (img) => {
    setShareImage(img);
    setShareStep("confirm");
  };

  // ── Audio playback ────────────────────────────────────────
  const toggleAudio = (msg) => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended  = null;
      currentAudioRef.current.ontimeupdate = null;
    }
    if (playingId === msg._id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(msg.pieceJointe?.path);
    audio.ontimeupdate = () => {
      setAudioProgress(p => ({ ...p, [msg._id]: { current: audio.currentTime, total: audio.duration || msg.pieceJointe?.duration || 0 } }));
    };
    audio.onended = () => {
      setPlayingId(null);
      setAudioProgress(p => ({ ...p, [msg._id]: { current: 0, total: audio.duration || msg.pieceJointe?.duration || 0 } }));
    };
    audio.play().catch(() => toast.error("Lecture impossible"));
    currentAudioRef.current = audio;
    setPlayingId(msg._id);
  };

  // ── Delete message ────────────────────────────────────────
  // AUDIT-07 — retrait de l'état local uniquement après confirmation
  // serveur (plus de retrait optimiste silencieux) ; erreur affichée sinon.
  const deleteMsg = async (msgId) => {
    try {
      await api.delete(`/messages/${msgId}`);
      setMessages(prev => {
        const next = prev.filter(m => m._id !== msgId);
        // AUDIT-MESSAGES-PhaseC — même correctif que côté backend
        // (dernier_message_apercu) : sans ça, la liste des conversations
        // affichait encore l'aperçu du message qui vient d'être supprimé
        // jusqu'au prochain rechargement.
        const last = next[next.length - 1];
        const apercu = last ? (last.contenu || (last.pieceJointe
          ? ({ audio:"🎙️ Message vocal", image:"🖼️ Image", document:"📄 Document" }[last.pieceJointe.type] || "📎 Pièce jointe")
          : "")) : "";
        if (selected) {
          setConvs(cs => cs.map(c => c._id === selected._id
            ? { ...c, dernier_message_apercu: apercu, dernier_message: last ? last.date_envoi : c.dernier_message }
            : c));
        }
        return next;
      });
      if (playingId === msgId) {
        currentAudioRef.current?.pause();
        setPlayingId(null);
      }
    } catch {
      toast.error("Impossible de supprimer ce message.");
    }
  };

  // ── Filtered convs ────────────────────────────────────────
  const filteredConvs = convs.filter(c => {
    const name = getConvDisplayName(c, me._id);
    if (search && !name?.toLowerCase().includes(search.toLowerCase()) && !c.dernier_message_apercu?.toLowerCase().includes(search.toLowerCase())) return false;
    // AUDIT-MESSAGES-PhaseB — une conversation archivée reste réellement
    // masquée de la vue par défaut ("Tous") — sinon archiver n'aurait aucun
    // effet visible — mais reste consultable via le filtre dédié "Archivées"
    // (sinon impossible de la restaurer sans nouvelle activité).
    if (filter === "archivees") return c.archivee;
    if (c.archivee) return false;
    if (filter === "non_lus") return c.non_lus > 0;
    if (filter === "favoris") return c.favori;
    if (filter === "groupes") return isGroupConv(c);
    return true;
  });

  // AUDIT-MESSAGES-PhaseA — remplace l'ancien état local "groups" (jamais
  // rechargé depuis le backend, perdu au rafraîchissement) : dérivé des
  // vraies conversations chargées via GET /messages, qui inclut déjà les
  // conversations de type 'groupe'.
  const groupConvs = convs.filter(isGroupConv);
  const totalNonLus = convs.reduce((s, c) => s + (c.non_lus || 0), 0);
  const notifsNonLues = notifs.filter(n => !n.lu).length;

  // ── Selected info ─────────────────────────────────────────
  const selContact = selected && !isGroupConv(selected) ? getOtherMember(selected, me._id) : null;
  const selGroup   = selected && isGroupConv(selected)  ? selected : null;

  // ── Group messages by date ────────────────────────────────
  const groupedMessages = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    if (!prev || !isSameDay(msg.date_envoi, prev.date_envoi)) {
      acc.push({ type:"date", label: fmtDay(msg.date_envoi), key:`d_${i}` });
    }
    acc.push(msg);
    return acc;
  }, []);

  // Types réels du modèle backend Notification (enum), pas les catégories
  // fictives d'origine (resultat/rdv/urgent/facture/patient/stock) qui ne
  // correspondaient à aucune valeur jamais renvoyée par l'API.
  const notifIcons = { info:"ℹ️", warning:"⚠️", critical:"🚨", success:"✅", ai_alert:"🤖", rappel:"⏰", alert:"🔔" };
  const notifColors = { critique:"#DC2626", haute:"#D97706", normale:"#0EA5A0" };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="msg">

        {/* ── HERO ── */}
        <Hero
          icon={MessageSquare}
          title="Messagerie"
          dateLabel={
            <>
              {totalNonLus > 0 ? <span style={{ color:"#FCA5A5", fontWeight:600 }}>{totalNonLus} message(s) non lu(s)</span> : "Tous les messages lus"} · {convs.length} conversation(s)
            </>
          }
          right={
            <>
              <button className="hero-btn-ghost" style={{ position:"relative" }} onClick={() => setTab("notifications")}
                aria-label={notifsNonLues > 0 ? `Notifications, ${notifsNonLues} non lue${notifsNonLues > 1 ? 's' : ''}` : 'Notifications'}>
                <Bell size={14} />
                {notifsNonLues > 0 && <span aria-hidden="true" style={{ position:"absolute", top:-6, right:-6, width:18, height:18, background:"#DC2626", color:"#fff", borderRadius:"50%", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{notifsNonLues}</span>}
              </button>
              <Button icon={Plus} disabled title="Fonctionnalité momentanément indisponible">Nouveau message</Button>
            </>
          }
        />

        {/* Tabs */}
        {(() => {
            const TABS = [
              { key:"inbox",         icon:I.chat,    label:"Conversations",         labelM:"Messages",   badge:totalNonLus>0?totalNonLus:null },
              { key:"groupes",       icon:I.users,   label:`Groupes (${groupConvs.length})`, labelM:"Groupes" },
              { key:"notifications", icon:I.bell,    label:"Notifications",         labelM:"Notifs",     badge:notifsNonLues>0?notifsNonLues:null },
              { key:"patients",      icon:"📱",       label:"Communication patients",labelM:"Patients" },
              { key:"historique",    icon:I.archive, label:"Historique & Audit",    labelM:"Historique" },
            ];
            return (
              <div className="tab-bar" style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:4}:{}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`tab-bar-item ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{typeof t.icon==="string"?t.icon:t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.badge&&<span className="tab-bar-item-count">{t.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })()}

        {/* ══ INBOX / CHAT ══ */}
        {tab === "inbox" && (
          <div className="msg-layout">
            {/* ── SIDEBAR — masquée sur mobile quand une conv est ouverte ── */}
            <div className="msg-sidebar" style={isMobile && selected ? {display:'none'} : {}}>
              <div className="msg-sidebar-hdr">
                <div className="msg-search">
                  <span className="msg-search-ic">{I.search}</span>
                  <input placeholder="Rechercher une conversation..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>

              {/* Filters */}
              <div className="msg-filters">
                {[
                  { id:"tous",     label:"Tous" },
                  { id:"non_lus",  label:`Non lus ${totalNonLus > 0 ? `(${totalNonLus})` : ""}` },
                  { id:"favoris",  label:"⭐ Favoris" },
                  { id:"groupes",  label:"👥 Groupes" },
                  { id:"archivees",label:"📦 Archivées" },
                ].map(f => (
                  <button key={f.id} className={`msg-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Conv list */}
              <div className="msg-conv-list">
                {loading ? (
                  <div style={{ padding:24, textAlign:"center", color:"var(--cm)", fontSize:13 }}>Chargement...</div>
                ) : filteredConvs.length === 0 ? (
                  <div style={{ padding:24, textAlign:"center" }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
                    <div style={{ color:"var(--cm)", fontSize:13 }}>{search ? `Aucun résultat pour "${search}"` : "Aucune conversation"}</div>
                  </div>
                ) : filteredConvs.map((conv, i) => {
                  const isGroup = isGroupConv(conv);
                  const contact = isGroup ? null : getOtherMember(conv, me._id);
                  const name = getConvDisplayName(conv, me._id);
                  const isActive = selected?._id === conv._id;
                  const hasUnread = conv.non_lus > 0;
                  return (
                    <div key={conv._id} className={`msg-conv-item ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`} onClick={() => openConv(conv)}>
                      {isGroup ? (
                        <div style={{ width:42, height:42, borderRadius:12, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                          👥
                        </div>
                      ) : (
                        <Av user={contact} size={42} idx={i} showStatus />
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
                          <div className="conv-name">{name}</div>
                          <div className="conv-time">{fmtTime(conv.dernier_message)}</div>
                        </div>
                        {!isGroup && <div className="conv-role">{getRoleLbl(contact?.role)} · {contact?.service}</div>}
                        {isGroup && <div className="conv-role">{(conv.membres || []).length} membre(s)</div>}
                        <div className="conv-preview">{conv.dernier_message_apercu || "Démarrer la conversation"}</div>
                      </div>
                      {hasUnread && <div className="conv-unread-dot">{conv.non_lus}</div>}
                      {conv.favori && !hasUnread && <span style={{ position:"absolute", top:10, right:10, fontSize:10 }}>⭐</span>}
                    </div>
                  );
                })}

                {/* New message section */}
                <div className="msg-section-lbl">Nouveau message</div>
                {users.map((u, i) => (
                  <div key={u._id} className="msg-conv-item" onClick={() => startConv(u._id)} style={{ opacity:.85 }}>
                    <Av user={u} size={38} idx={i} showStatus />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="conv-name" style={{ fontSize:12 }}>{u.prenom} {u.nom}</div>
                      <div className="conv-role">{getRoleLbl(u.role)}</div>
                    </div>
                    <div style={{ width:22, height:22, borderRadius:6, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {I.plus}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CHAT AREA — masquée sur mobile quand aucune conv n'est sélectionnée ── */}
            <div className="msg-chat" style={isMobile && !selected ? {display:'none'} : {}}>
              {!selected ? (
                <div className="msg-empty">
                  <div style={{ width:72, height:72, borderRadius:20, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>💬</div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontWeight:700, fontSize:16, color:"var(--cn)", marginBottom:6 }}>Sélectionnez une conversation</div>
                    <div style={{ fontSize:13, color:"var(--cm)" }}>Choisissez une conversation dans la liste<br />ou démarrez un nouveau message.</div>
                  </div>
                  <button className="cbtn cbtn-teal" disabled title="Fonctionnalité momentanément indisponible" style={{ opacity:.5, cursor:"not-allowed" }}>{I.plus} Nouveau message</button>
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="msg-chat-hdr">
                    {isMobile && (
                      <button className="msg-back-btn" onClick={() => setSelected(null)}>
                        ← Retour
                      </button>
                    )}
                    <div className="msg-chat-hdr-info">
                      {isGroupConv(selected) ? (
                        <div style={{ width:42, height:42, borderRadius:12, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>👥</div>
                      ) : (
                        <Av user={selContact} size={42} idx={0} showStatus />
                      )}
                      <div>
                        <div style={{ fontWeight:700, fontSize:15, color:"var(--cn)" }}>
                          {getConvDisplayName(selected, me._id)}
                        </div>
                        <div style={{ fontSize:12, color:"var(--cm)", display:"flex", alignItems:"center", gap:8 }}>
                          {isGroupConv(selected) ? (
                            <span>{(selGroup?.membres || []).length} membre(s)</span>
                          ) : (
                            <>
                              <span>{getRoleLbl(selContact?.role)} · {selContact?.service}</span>
                              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                                <span style={{ width:7, height:7, borderRadius:"50%", background:selContact?.statut_ligne === "online" ? "#059669" : selContact?.statut_ligne === "away" ? "#D97706" : "#9CA3AF", display:"inline-block" }} />
                                {selContact?.statut_ligne === "online" ? "En ligne" : selContact?.statut_ligne === "away" ? "Absent" : "Hors ligne"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="msg-chat-actions" style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px", background: showInfo?"#EEF4FF":"", color: showInfo?"var(--cb)":"" }} title="Informations" onClick={() => setShowInfo(!showInfo)}>
                        {I.info}
                      </button>
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px" }} title={selected.favori ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => toggleFavoriConv(selected)}>
                        <span style={{ color: selected.favori ? "#D97706" : "var(--cm)", fontSize:15 }}>{selected.favori ? "⭐" : I.star}</span>
                      </button>
                      <button className="cbtn-danger cbtn cbtn-sm" title="Archiver la conversation" onClick={() => toggleArchiveConv(selected)}>
                        {I.archive}
                      </button>
                    </div>
                  </div>

                  {/* Messages area */}
                  <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
                    <div className="msg-area" style={{ flex:1 }}>
                      {messagesError && (
                        <div style={{ flex:1, height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, color:"var(--cm)", fontSize:13 }}>
                          <div style={{ fontSize:28 }}>⚠️</div>
                          <div>Impossible de charger cette conversation.</div>
                          <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={retryLoadMessages}>Réessayer</button>
                        </div>
                      )}
                      {!messagesError && groupedMessages.length === 0 && (
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--cm)", fontSize:13 }}>
                          Aucun message — Commencez la conversation !
                        </div>
                      )}
                      {!messagesError && groupedMessages.map((item) => {
                        if (item.type === "date") return (
                          <div key={item.key} className="msg-date-sep"><span>{item.label}</span></div>
                        );
                        const msg = item;
                        const isMe = msg.expediteur?._id === me._id || msg.expediteur?._id === "me";
                        const senderName = isMe ? "Moi" : `${msg.expediteur?.prenom} ${msg.expediteur?.nom}`;
                        const isPlaying = playingId === msg._id;
                        const prog = audioProgress[msg._id];
                        const progPct = prog && prog.total > 0 ? Math.min(100, (prog.current / prog.total) * 100) : 0;
                        const progTime = prog ? fmtRecTime(Math.floor(prog.current)) : fmtRecTime(msg.pieceJointe?.duration || 0);
                        return (
                          <div key={msg._id} className="fu msg-wrap" style={{ display:"flex", flexDirection:"column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom:4, position:"relative" }}>
                            {!isMe && <div style={{ fontSize:10, color:"var(--cm)", marginLeft:38, marginBottom:2, fontWeight:600 }}>{senderName}</div>}

                            {/* ── Actions on hover ── */}
                            <div className={`msg-hover-actions ${isMe ? "me" : "other"}`}>
                              {["👍","❤️","😊"].map(e => (
                                <button key={e} className="mha-btn" onClick={() => toggleReaction(msg._id, e)} title={e}>{e}</button>
                              ))}
                              <div style={{ width:1, background:"var(--cbr)", margin:"0 2px" }} />
                              <button className="mha-btn" title="Transférer" onClick={() => setForwardMsg(msg)}>{I.forward}</button>
                              {isMe && (
                                <button className="mha-btn del" title="Supprimer" onClick={() => deleteMsg(msg._id)}>🗑️</button>
                              )}
                            </div>

                            <div className={`msg-bubble-wrap ${isMe ? "me" : ""}`}>
                              {!isMe && (
                                <div style={{ width:30, height:30, borderRadius:9, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, alignSelf:"flex-end" }}>
                                  {getRoleIcon(msg.expediteur?.role)}
                                </div>
                              )}
                              <div>
                                {/* ── Résultat médical ── */}
                                {msg.type_special === "resultat" ? (
                                  <div style={{ background:isMe ? "rgba(255,255,255,.15)" : "#F0FDF4", border:`1.5px solid ${isMe ? "rgba(255,255,255,.3)" : "#A7F3D0"}`, borderRadius:14, padding:"10px 14px", maxWidth:320 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:isMe ? "rgba(255,255,255,.8)" : "#059669", marginBottom:6, textTransform:"uppercase", letterSpacing:.4 }}>🔬 Résultat médical</div>
                                    <div style={{ fontSize:13, color:isMe ? "#fff" : "var(--cn)", lineHeight:1.5 }}>{msg.contenu}</div>
                                    <button style={{ marginTop:8, fontSize:11, fontWeight:600, color:isMe ? "rgba(255,255,255,.8)" : "var(--ct)", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:4 }} onClick={() => toast.success("📄 Ouverture du résultat...")}>
                                      {I.dl} Télécharger le résultat
                                    </button>
                                  </div>

                                ) : msg.pieceJointe?.type === "audio" ? (
                                  /* ── Bulle audio ── */
                                  <div className={`msg-audio-bubble ${isMe ? "me" : "other"}`}>
                                    {/* Bouton play/pause */}
                                    <button className={`msg-audio-play ${isMe ? "me" : "other"}`} onClick={() => toggleAudio(msg)}>
                                      {isPlaying
                                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                        : I.play}
                                    </button>
                                    {/* Contenu */}
                                    <div style={{ flex:1, minWidth:0 }}>
                                      {/* Waveform animée */}
                                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                        <div className="msg-rec-wave" style={{ opacity: isPlaying ? 1 : 0.45 }}>
                                          {[0,1,2,3,4].map(n => (
                                            <span key={n} style={{
                                              animationPlayState: isPlaying ? "running" : "paused",
                                              background: isMe ? "rgba(255,255,255,.9)" : "var(--cb)",
                                            }} />
                                          ))}
                                        </div>
                                        <span style={{ fontSize:10, fontWeight:700, color:isMe?"rgba(255,255,255,.75)":"var(--cn)", fontVariantNumeric:"tabular-nums", marginLeft:"auto" }}>
                                          {progTime}
                                        </span>
                                      </div>
                                      {/* Barre de progression */}
                                      <div className={`msg-audio-progress ${isMe?"me":"other"}`}>
                                        <div className={`msg-audio-fill ${isMe?"me":"other"}`} style={{ width:`${progPct}%` }} />
                                      </div>
                                      {/* Label + actions */}
                                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                        <span style={{ fontSize:10, color:isMe?"rgba(255,255,255,.5)":"#9CA3AF" }}>🎙️ Message vocal</span>
                                        {isMe && (
                                          <div style={{ display:"flex", gap:4 }}>
                                            <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, opacity:.7, padding:"0 2px" }} title="Télécharger"
                                              onClick={() => { const a=document.createElement('a'); a.href=msg.pieceJointe?.path; a.download=`vocal-${msg._id}.webm`; a.click(); }}>
                                              ⬇️
                                            </button>
                                            <button style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, opacity:.7, padding:"0 2px" }} title="Supprimer"
                                              onClick={() => deleteMsg(msg._id)}>
                                              🗑️
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                ) : msg.pieceJointe?.type === "image" ? (
                                  /* ── Bulle image ── */
                                  <div style={{ maxWidth:260 }}>
                                    <a href={msg.pieceJointe.path} target="_blank" rel="noreferrer">
                                      <img src={msg.pieceJointe.path} alt={msg.pieceJointe.filename || "Image"} style={{ maxWidth:"100%", borderRadius:14, display:"block", border:isMe?"1.5px solid rgba(255,255,255,.3)":"1.5px solid var(--cbr)" }} />
                                    </a>
                                  </div>

                                ) : msg.pieceJointe?.type === "document" ? (
                                  /* ── Bulle document ── */
                                  <a href={msg.pieceJointe.path} target="_blank" rel="noreferrer" className="msg-attachment" style={isMe ? { color:"#fff" } : undefined}>
                                    {I.file}
                                    <span style={{ fontSize:12.5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{msg.pieceJointe.filename || "Document"}</span>
                                  </a>

                                ) : (
                                  /* ── Bulle texte ── */
                                  <div className={`msg-bubble ${isMe ? "me" : "other"}`}>
                                    {msg.contenu}
                                  </div>
                                )}

                                {/* Meta */}
                                <div className={`msg-meta ${isMe ? "me" : "other"}`}>
                                  <span>{new Date(msg.date_envoi).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}</span>
                                  {/* AUDIT-3.3 — un message dont l'envoi a échoué ne doit jamais
                                      afficher le même statut qu'un message réellement envoyé. */}
                                  {isMe && msg.echec ? (
                                    <span
                                      className="msg-status"
                                      style={{ color:"#DC2626", cursor:"pointer", fontWeight:600, display:"inline-flex", alignItems:"center", gap:3 }}
                                      onClick={() => retrySendMsg(msg)}
                                      title="Échec de l'envoi — cliquer pour réessayer"
                                    >
                                      ⚠ Échec — Réessayer
                                    </span>
                                  ) : isMe && msg.envoiEnCours ? (
                                    <span className="msg-status" style={{ color:"rgba(255,255,255,.6)" }}>…</span>
                                  ) : isMe && (
                                    <span className="msg-status" style={{ color: msg.lu ? "#0EA5A0" : "rgba(255,255,255,.5)" }}>
                                      {msg.lu ? "✓✓" : "✓"}
                                    </span>
                                  )}
                                </div>
                                {/* Reactions — {emoji, utilisateur} par entrée (AUDIT-07),
                                    regroupées par emoji pour l'affichage (compteur si >1). */}
                                {msg.reactions?.length > 0 && (
                                  <div className="reactions" style={{ justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                    {Object.entries(
                                      msg.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
                                    ).map(([emoji, count]) => (
                                      <span key={emoji} className="react-pill" onClick={() => toggleReaction(msg._id, emoji)}>
                                        {emoji}{count > 1 ? ` ${count}` : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Typing indicator */}
                      {selected && (
                        <div style={{ display:"flex", alignItems:"center", gap:8, opacity:.6 }}>
                          <div style={{ width:26, height:26, borderRadius:8, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>
                            {getRoleIcon(selContact?.role)}
                          </div>
                          <div style={{ background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:12, padding:"8px 14px", display:"flex", gap:4, alignItems:"center" }}>
                            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                          </div>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>

                    {/* Info panel */}
                    {showInfo && (
                      <div style={{ width:240, borderLeft:"1.5px solid var(--cbr)", padding:16, background:"#FAFBFF", overflowY:"auto" }}>
                        <div style={{ fontWeight:700, fontSize:13, color:"var(--cn)", marginBottom:14 }}>Informations</div>
                        {selContact && (
                          <div style={{ textAlign:"center", marginBottom:16 }}>
                            <Av user={selContact} size={56} idx={0} showStatus />
                            <div style={{ fontWeight:700, color:"var(--cn)", marginTop:10, fontSize:14 }}>{selContact.prenom} {selContact.nom}</div>
                            <span className={`cbdg ${getRoleCls(selContact.role)}`} style={{ marginTop:6 }}>{getRoleLbl(selContact.role)}</span>
                            <div style={{ fontSize:11, color:"var(--cm)", marginTop:6 }}>{selContact.service}</div>
                          </div>
                        )}
                        {selGroup && (
                          <div style={{ textAlign:"center", marginBottom:16 }}>
                            <div style={{ width:56, height:56, borderRadius:14, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto" }}>{selGroup.icon}</div>
                            <div style={{ fontWeight:700, color:"var(--cn)", marginTop:10, fontSize:14 }}>{selGroup.nom}</div>
                            <span className="cbdg blue" style={{ marginTop:6 }}>{selGroup.membres} membres</span>
                          </div>
                        )}
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Actions rapides</div>
                        {Object.entries(SHARE_CFG).map(([key, a]) => (
                          <button key={key} className="cbtn cbtn-ghost cbtn-sm" style={{ width:"100%", justifyContent:"flex-start", marginBottom:6, fontSize:11 }} onClick={() => openShare(key)}>
                            <span>{a.icon}</span> {a.title}
                          </button>
                        ))}
                        {/* AUDIT-MESSAGES-PhaseA — "Messages chiffrés de bout
                            en bout" retiré : affirmation fausse, aucun
                            chiffrement E2E n'existe (contenu stocké en clair
                            dans MongoDB). Ne pas réintroduire de mention de
                            sécurité tant qu'aucune mesure réelle ne l'appuie. */}
                      </div>
                    )}
                  </div>

                  {/* Input area */}
                  <div className="msg-input-area">
                    {isRecording ? (
                      /* ─── Mode enregistrement vocal ─── */
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div className="msg-rec-wrap">
                          <div className="msg-rec-dot" />
                          <div className="msg-rec-timer">{fmtRecTime(recSeconds)}</div>
                          <div className="msg-rec-wave">
                            <span /><span /><span /><span /><span />
                          </div>
                          <span className="msg-rec-label">Enregistrement en cours…</span>
                        </div>
                        {/* Annuler */}
                        <button className="msg-rec-stop" title="Annuler" onClick={() => stopVoice(false)}>✕</button>
                        {/* Envoyer */}
                        <button className="msg-rec-send" title="Envoyer le message vocal" onClick={() => stopVoice(true)}>
                          {I.send}
                        </button>
                      </div>
                    ) : (
                      /* ─── Mode texte normal ─── */
                      <div className="msg-input-row">
                        <div className="msg-input-wrap">
                          <textarea
                            ref={textRef}
                            className="msg-textarea"
                            placeholder={`Message à ${getConvDisplayName(selected, me._id)}…`}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKey}
                            rows={1}
                          />
                          <div className="msg-input-tools">
                            <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={handleFileSelected} />
                            <button className="msg-tool-btn" title="Pièce jointe" onClick={() => triggerFilePicker("document")}>{I.attach}</button>
                            <button className="msg-tool-btn" title="Image" onClick={() => triggerFilePicker("image")}>{I.image}</button>
                            <button className="msg-tool-btn" title="Document médical" onClick={() => triggerFilePicker("document")}>{I.file}</button>
                            <div style={{ position:"relative" }}>
                              <button className="msg-tool-btn" title="Emoji" onClick={() => setShowEmoji(v => !v)}>{I.emoji}</button>
                              {showEmoji && (
                                <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, background:"#fff", border:"1.5px solid var(--cbr)", borderRadius:12, boxShadow:"var(--shl)", padding:10, display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:2, zIndex:30, width:216 }}>
                                  {EMOJI_LIST.map(e => (
                                    <button key={e} type="button" style={{ background:"none", border:"none", cursor:"pointer", fontSize:19, padding:5, borderRadius:8 }}
                                      onMouseOver={ev => ev.currentTarget.style.background="#F0F5FF"} onMouseOut={ev => ev.currentTarget.style.background="none"}
                                      onClick={() => { setInput(v => v + e); setShowEmoji(false); textRef.current?.focus(); }}>
                                      {e}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div style={{ flex:1 }} />
                            <div className="msg-hint" style={{ fontSize:10, color:"var(--cm)" }}>Entrée pour envoyer · Maj+Entrée pour saut de ligne</div>
                          </div>
                        </div>
                        {/* Microphone — si champ vide */}
                        {!input.trim() && (
                          <button className="msg-mic-btn" title="Enregistrer un message vocal" onClick={startVoice}>
                            {I.mic}
                          </button>
                        )}
                        {/* Envoyer — si texte saisi */}
                        {input.trim() && (
                          <button className="msg-send-btn" onClick={sendMsg} disabled={sending}>
                            {I.send}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ GROUPES ══ */}
        {tab === "groupes" && (
          <div style={{ padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Groupes de discussion</div>
                <div style={{ fontSize:12, color:"var(--cm)" }}>{groupConvs.length} groupe(s) actif(s)</div>
              </div>
              <button className="cbtn cbtn-teal" onClick={() => setShowNewGrp(true)}>{I.plus} Créer un groupe</button>
            </div>
            {groupConvs.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 0", color:"var(--cm)" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
                <div>Aucun groupe pour l'instant</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
                {groupConvs.map((g) => (
                  <div key={g._id} className="adm-card fu" style={{ cursor:"pointer" }} onClick={() => { setTab("inbox"); openConv(g); }}>
                    <div style={{ padding:20 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                        <div style={{ width:52, height:52, borderRadius:14, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>👥</div>
                        <div>
                          <div style={{ fontWeight:700, color:"var(--cn)", fontSize:15 }}>{g.nom}</div>
                          <span className="cbdg blue">{(g.membres || []).length} membre(s)</span>
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:"var(--cm)", background:"#F8FAFD", borderRadius:8, padding:"8px 10px" }}>
                        <strong>Dernier message :</strong> {g.dernier_message_apercu || "Aucun message"}
                      </div>
                      <div style={{ display:"flex", gap:8, marginTop:14 }}>
                        <button className="cbtn cbtn-primary cbtn-sm" style={{ flex:1 }}>{I.chat} Ouvrir</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ NOTIFICATIONS ══ */}
        {tab === "notifications" && (
          <div style={{ padding:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)" }}>Notifications</div>
                <div style={{ fontSize:12, color:"var(--cm)" }}>{notifsNonLues} non lue(s) · {notifs.length} au total</div>
              </div>
              <button className="cbtn cbtn-ghost cbtn-sm" onClick={readAllNotifs}>
                {I.check2} Tout marquer comme lu
              </button>
            </div>
            <div className="adm-card">
              {notifs.map((n, i) => (
                <div key={n._id} className={`notif-item ${!n.lu ? "unread" : ""}`} onClick={() => readNotif(n._id)}>
                  <div className="notif-dot" style={{ background: n.lu ? "#F8FAFD" : "#EEF4FF" }}>
                    <span style={{ fontSize:18 }}>{notifIcons[n.type] || "🔔"}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:700, fontSize:13, color:"var(--cn)" }}>{n.titre}</span>
                      <span className={`cbdg ${n.priorite === "critique" ? "red" : n.priorite === "haute" ? "orange" : "teal"}`}>
                        {n.priorite === "critique" ? "🚨 Critique" : n.priorite === "haute" ? "⚠ Haute" : "Normale"}
                      </span>
                      {!n.lu && <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--ct)", display:"inline-block" }} />}
                    </div>
                    <div style={{ fontSize:12, color:"var(--cm)", marginTop:3 }}>{n.message}</div>
                    <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{fmtFull(n.createdAt)}</div>
                  </div>
                </div>
              ))}
              {notifs.length === 0 && (
                <div style={{ padding:40, textAlign:"center", color:"var(--cm)" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                  <div>Aucune notification</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ PATIENTS ══ */}
        {tab === "patients" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:20 }}>Communication avec les patients</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:20, marginBottom:24 }}>
              {[
                { icon:"📱", titre:"SMS", desc:"Envoi de SMS groupés ou individuels", couleur:"#059669", nb:128 },
                { icon:"📧", titre:"E-mail", desc:"Emails automatiques et personnalisés", couleur:"#1B4F9E", nb:84 },
                { icon:"💬", titre:"WhatsApp", desc:"Intégration WhatsApp Business API", couleur:"#25D366", nb:52 },
              ].map(c => (
                <div key={c.titre} className="adm-card" style={{ borderTop:`3px solid ${c.couleur}` }}>
                  <div style={{ padding:20 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                      <div style={{ fontSize:28 }}>{c.icon}</div>
                      <span className="cbdg green">{c.nb} envoyés</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:15, color:"var(--cn)", marginBottom:4 }}>{c.titre}</div>
                    <div style={{ fontSize:12, color:"var(--cm)", marginBottom:14 }}>{c.desc}</div>
                    <button className="cbtn cbtn-teal cbtn-sm" style={{ width:"100%" }} onClick={() => toast.success(`${c.icon} Envoi via ${c.titre}...`)}>
                      Envoyer via {c.titre}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-card">
              <div className="adm-card-hdr"><h3>📤 Templates de communication</h3></div>
              <div style={{ padding:20, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
                {[
                  { titre:"Confirmation RDV",       icon:"📅", canal:"SMS + Email" },
                  { titre:"Rappel de consultation",  icon:"⏰", canal:"SMS" },
                  { titre:"Résultats disponibles",   icon:"🔬", canal:"SMS + WhatsApp" },
                  { titre:"Facture générée",          icon:"💰", canal:"Email" },
                  { titre:"Rappel paiement",          icon:"💳", canal:"SMS + Email" },
                  { titre:"Sortie d'hospitalisation", icon:"🚪", canal:"Email" },
                ].map(t => (
                  <div key={t.titre} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div>
                      <div style={{ fontSize:16, marginBottom:4 }}>{t.icon}</div>
                      <div style={{ fontWeight:600, fontSize:12, color:"var(--cn)" }}>{t.titre}</div>
                      <span className="cbdg gray" style={{ fontSize:10 }}>{t.canal}</span>
                    </div>
                    <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => toast.success(`${t.icon} Envoi template : ${t.titre}`)}>Envoyer</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ HISTORIQUE ══ */}
        {tab === "historique" && (
          <div style={{ padding:24 }}>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:20 }}>
              {/* Statistiques */}
              <div className="adm-card fu">
                <div className="adm-card-hdr"><h3>📊 Statistiques de communication</h3></div>
                <div style={{ padding:20 }}>
                  <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:16 }}>
                    {[
                      { lbl:"Messages envoyés", val:"1 284", col:"#1B4F9E" },
                      { lbl:"Messages reçus",   val:"1 102", col:"#0EA5A0" },
                      { lbl:"Groupes actifs",   val:groupConvs.length, col:"#7C3AED" },
                      { lbl:"Taux de réponse",  val:"94%",  col:"#059669" },
                    ].map(k => (
                      <div key={k.lbl} style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:14, textAlign:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color:k.col }}>{k.val}</div>
                        <div style={{ fontSize:11, color:"var(--cm)", marginTop:2 }}>{k.lbl}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>Activité par service</div>
                  {[
                    ["Médecins",       320, "#1B4F9E"],
                    ["Administration", 245, "#7C3AED"],
                    ["Infirmiers",     198, "#0EA5A0"],
                    ["Pharmacie",      142, "#059669"],
                    ["Laboratoire",    98,  "#D97706"],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                        <span style={{ color:"var(--cm)" }}>{lbl}</span>
                        <span style={{ fontWeight:700, color:"var(--cn)" }}>{val}</span>
                      </div>
                      <div style={{ background:"#EEF4FF", borderRadius:99, height:6, overflow:"hidden" }}>
                        <div style={{ width:`${Math.round(val/320*100)}%`, height:"100%", background:col, borderRadius:99 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit */}
              <div className="adm-card fu">
                <div className="adm-card-hdr">
                  <h3>🔍 Journal d'audit messagerie</h3>
                  <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => toast.success("📥 Export en cours...")}>Export</button>
                </div>
                <div style={{ padding:"8px 0" }}>
                  {[
                    { ic:"📤", act:"Message envoyé",       user:"Dr. Sophie Martin",  det:"Message à Dr. Leblanc",               d:"2025-06-01T10:30:00" },
                    { ic:"👁️", act:"Message lu",           user:"Alain Koumba",       det:"Conversation Médecins",               d:"2025-06-01T10:15:00" },
                    { ic:"📎", act:"Document partagé",      user:"Paul Obiang",        det:"Résultat NFS — Patient Dupont",       d:"2025-06-01T09:45:00" },
                    { ic:"🗑️", act:"Message supprimé",      user:"Marie Nzigou",       det:"Message de la conv. Urgences",        d:"2025-05-31T22:30:00" },
                    { ic:"👥", act:"Groupe créé",           user:"Alain Koumba",       det:"Groupe 'Bloc Opératoire' (5 membres)",d:"2025-05-31T14:00:00" },
                  ].map((a, i) => (
                    <div key={i} style={{ display:"flex", gap:12, padding:"12px 20px", borderBottom: i < 4 ? "1px solid #F3F7FF" : "" }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:15 }}>{a.ic}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:12, color:"var(--cn)" }}>{a.act}</div>
                        <div style={{ fontSize:11, color:"var(--cm)" }}>{a.user} · {a.det}</div>
                      </div>
                      <div style={{ fontSize:10, color:"#9CA3AF", whiteSpace:"nowrap" }}>{fmtFull(a.d)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ MODAL : CRÉER GROUPE ═══ */}
        <Modal open={showNewGrp} onClose={() => setShowNewGrp(false)} title={<>{I.plus} Créer un groupe</>}>
          <form onSubmit={createGroup}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Nom du groupe *</label>
                <input className="cinp" required placeholder="Ex: Équipe Chirurgie" value={newGrpForm.nom} onChange={e => setNewGrpForm(f => ({ ...f, nom:e.target.value }))} />
              </div>
              <div>
                <label className="clbl">Description</label>
                <input className="cinp" placeholder="Objectif du groupe..." value={newGrpForm.description} onChange={e => setNewGrpForm(f => ({ ...f, description:e.target.value }))} />
              </div>
              <div>
                <label className="clbl">Membres</label>
                <div style={{ maxHeight:220, overflowY:"auto", border:"1.5px solid var(--cbr)", borderRadius:12, padding:8 }}>
                  {users.map((u, i) => {
                    const selected = newGrpForm.membres.includes(u._id);
                    return (
                      <div key={u._id} className="grp-member" onClick={() => setNewGrpForm(f => ({ ...f, membres: selected ? f.membres.filter(id => id !== u._id) : [...f.membres, u._id] }))} style={{ cursor:"pointer", borderRadius:8, padding:"8px 10px", background: selected ? "#EEF4FF" : "transparent", borderBottom:"1px solid #F3F7FF" }}>
                        <input type="checkbox" checked={selected} onChange={() => {}} style={{ accentColor:"var(--ct)", width:14, height:14, flexShrink:0 }} />
                        <Av user={u} size={32} idx={i} />
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{u.prenom} {u.nom}</div>
                          <div style={{ fontSize:10, color:"var(--cm)" }}>{getRoleLbl(u.role)}</div>
                        </div>
                        {selected && <span style={{ marginLeft:"auto", color:"var(--ct)", fontSize:14 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
                {newGrpForm.membres.length > 0 && (
                  <div style={{ fontSize:11, color:"var(--ct)", marginTop:4 }}>{newGrpForm.membres.length} membre(s) sélectionné(s)</div>
                )}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setShowNewGrp(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }}>{I.users} Créer le groupe</button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : TRANSFÉRER ═══ */}
        <Modal open={!!forwardMsg} onClose={() => setForwardMsg(null)} title={<>{I.forward} Transférer le message</>} maxWidth={440}>
          <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:360, overflowY:"auto" }}>
            {convs.filter(c => !c.archivee).length === 0 && (
              <div style={{ textAlign:"center", padding:20, color:"var(--cm)", fontSize:13 }}>Aucune conversation disponible.</div>
            )}
            {convs.filter(c => !c.archivee).map((c, i) => (
              <div key={c._id} className="msg-conv-item" style={{ borderRadius:10, cursor:"pointer" }} onClick={() => forwardMessage(c._id)}>
                {isGroupConv(c) ? (
                  <div style={{ width:36, height:36, borderRadius:10, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>👥</div>
                ) : (
                  <Av user={getOtherMember(c, me._id)} size={36} idx={i} />
                )}
                <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{getConvDisplayName(c, me._id)}</div>
              </div>
            ))}
          </div>
        </Modal>

        {/* ═══ MODAL : PARTAGE DE DOCUMENT (Actions rapides) ═══ */}
        <Modal open={!!shareType} onClose={closeShare} title={shareType ? <>{SHARE_CFG[shareType].icon} {SHARE_CFG[shareType].title}</> : ""} maxWidth={460}>
          {shareType && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Étape 1 : patient */}
              {shareStep === "patient" && (
                <>
                  <input className="cinp" autoFocus placeholder="Rechercher un patient (nom, n° dossier, téléphone)..." value={shareQuery} onChange={e => setShareQuery(e.target.value)} />
                  <div style={{ maxHeight:320, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
                    {shareQuery.trim().length >= 2 && sharePatients.length === 0 && (
                      <div style={{ textAlign:"center", padding:16, color:"var(--cm)", fontSize:12 }}>Aucun patient trouvé.</div>
                    )}
                    {sharePatients.map(p => (
                      <div key={p._id} className="msg-conv-item" style={{ borderRadius:10, cursor:"pointer" }} onClick={() => pickSharePatient(p)}>
                        <div style={{ width:34, height:34, borderRadius:9, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🧑‍⚕️</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{p.prenom} {p.nom}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{p.numero_dossier || "—"} · {p.telephone || "—"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Étape 2 : sélection du document réel (labo / ordonnance / imagerie) */}
              {shareStep === "record" && (
                <>
                  <div style={{ fontSize:12, color:"var(--cm)" }}>Patient : <strong style={{ color:"var(--cn)" }}>{sharePatient?.prenom} {sharePatient?.nom}</strong></div>
                  <div style={{ maxHeight:320, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
                    {shareRecordsLoading && <div style={{ textAlign:"center", padding:16, color:"var(--cm)", fontSize:12 }}>Chargement...</div>}
                    {!shareRecordsLoading && shareRecords.length === 0 && (
                      <div style={{ textAlign:"center", padding:16, color:"var(--cm)", fontSize:12 }}>Aucun document disponible pour ce patient.</div>
                    )}
                    {!shareRecordsLoading && shareType === "labo" && shareRecords.map(r => (
                      <div key={r._id} className="msg-conv-item" style={{ borderRadius:10, cursor:"pointer" }} onClick={() => pickShareRecord(r)}>
                        <div style={{ width:34, height:34, borderRadius:9, background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🔬</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{r.date_prescription ? new Date(r.date_prescription).toLocaleDateString("fr-FR") : "—"} · {r.statut}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{r.medecin_prescripteur_nom || "Prescripteur inconnu"}{r.est_critique ? " · ⚠️ critique" : ""}</div>
                        </div>
                      </div>
                    ))}
                    {!shareRecordsLoading && shareType === "ordonnance" && shareRecords.map(rx => (
                      <div key={rx._id} className="msg-conv-item" style={{ borderRadius:10, cursor:"pointer" }} onClick={() => pickShareRecord(rx)}>
                        <div style={{ width:34, height:34, borderRadius:9, background:"#FEF3C7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>💊</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{rx.numero_rx} · {rx.statut}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{(rx.lignes || []).length} médicament(s) · {rx.date_prescription ? new Date(rx.date_prescription).toLocaleDateString("fr-FR") : "—"}</div>
                        </div>
                      </div>
                    ))}
                    {!shareRecordsLoading && shareType === "imagerie" && shareRecords.map(exam => (
                      <div key={exam._id} className="msg-conv-item" style={{ borderRadius:10, cursor: (exam.images || []).length ? "pointer" : "not-allowed", opacity: (exam.images || []).length ? 1 : .5 }} onClick={() => (exam.images || []).length && pickShareExam(exam)}>
                        <div style={{ width:34, height:34, borderRadius:9, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🩻</div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--cn)" }}>{exam.type_categorie || "Examen"} · {exam.statut}</div>
                          <div style={{ fontSize:11, color:"var(--cm)" }}>{(exam.images || []).length} image(s) réelle(s){!(exam.images || []).length ? " — aucune image enregistrée" : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setShareStep("patient")}>← Changer de patient</button>
                </>
              )}

              {/* Étape 2bis : choix de l'image réelle au sein d'un examen d'imagerie */}
              {shareStep === "image" && (
                <>
                  <div style={{ fontSize:12, color:"var(--cm)" }}>Examen : <strong style={{ color:"var(--cn)" }}>{shareRecord?.type_categorie || "Imagerie"}</strong></div>
                  <div style={{ maxHeight:320, overflowY:"auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {(shareRecord?.images || []).map((img, i) => (
                      <div key={i} style={{ border:"1.5px solid var(--cbr)", borderRadius:10, padding:8, cursor:"pointer", textAlign:"center" }} onClick={() => pickShareImage(img)}>
                        <div style={{ fontSize:22 }}>🖼️</div>
                        <div style={{ fontSize:10, color:"var(--cm)", wordBreak:"break-all" }}>{img.filename}</div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="cbtn cbtn-ghost cbtn-sm" onClick={() => setShareStep("record")}>← Retour aux examens</button>
                </>
              )}

              {/* Étape 3 : confirmation d'envoi */}
              {shareStep === "confirm" && (
                <>
                  <div style={{ background:"#F8FAFD", border:"1.5px solid var(--cbr)", borderRadius:12, padding:14, fontSize:13, color:"var(--cn)" }}>
                    {shareType === "dossier" && <>Envoyer le dossier de <strong>{sharePatient?.prenom} {sharePatient?.nom}</strong> à {getConvDisplayName(selected, me._id)} ?</>}
                    {shareType === "labo" && <>Envoyer le résultat labo du <strong>{shareRecord?.date_prescription ? new Date(shareRecord.date_prescription).toLocaleDateString("fr-FR") : ""}</strong> de {sharePatient?.prenom} {sharePatient?.nom} à {getConvDisplayName(selected, me._id)} ?</>}
                    {shareType === "ordonnance" && <>Envoyer l'ordonnance <strong>{shareRecord?.numero_rx}</strong> de {sharePatient?.prenom} {sharePatient?.nom} à {getConvDisplayName(selected, me._id)} ?</>}
                    {shareType === "imagerie" && <>Envoyer l'image <strong>{shareImage?.filename}</strong> ({shareRecord?.type_categorie}) de {sharePatient?.prenom} {sharePatient?.nom} à {getConvDisplayName(selected, me._id)} ?</>}
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button type="button" className="cbtn cbtn-ghost" onClick={() => setShareStep(shareType === "dossier" ? "patient" : shareType === "imagerie" && (shareRecord?.images || []).length > 1 ? "image" : "record")} disabled={shareSending}>← Retour</button>
                    <button type="button" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }} onClick={confirmShare} disabled={shareSending}>
                      {shareSending ? "Envoi..." : <>{I.send} Envoyer</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal>

      </div>
    </>
  );
}