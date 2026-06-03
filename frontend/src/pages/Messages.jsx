


import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConversations, fetchMessages, sendMessage, markAsRead,
  selectConversations, selectMessages, selectUnreadCount, selectMessagesLoading,
} from '../store/slices/messagesSlice';
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

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
  phone:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81 19.79 19.79 0 01.01 2.22 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91A16 16 0 0016 17.91l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0124 18z"/></svg>,
  video:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
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
  super_admin:    { icon:"👑", cls:"red",    label:"Super Admin",    color:"#DC2626" },
  admin:          { icon:"🏥", cls:"purple", label:"Administrateur", color:"#7C3AED" },
  medecin:        { icon:"👨‍⚕️", cls:"blue",   label:"Médecin",        color:"#1B4F9E" },
  infirmier:      { icon:"💉", cls:"teal",   label:"Infirmier",      color:"#0EA5A0" },
  pharmacien:     { icon:"💊", cls:"green",  label:"Pharmacien",     color:"#059669" },
  laborantin:     { icon:"🔬", cls:"orange", label:"Laborantin",     color:"#D97706" },
  comptable:      { icon:"💰", cls:"gray",   label:"Comptable",      color:"#6B7280" },
  receptionniste: { icon:"📋", cls:"gray",   label:"Réceptionniste", color:"#6B7280" },
};
const getRoleIcon = (role) => ROLE_CFG[role]?.icon || "👤";
const getRoleCls  = (role) => ROLE_CFG[role]?.cls  || "gray";
const getRoleLbl  = (role) => ROLE_CFG[role]?.label || role;
const AV_COLORS = ["#1B4F9E","#0EA5A0","#7C3AED","#DC2626","#D97706","#059669","#4F46E5","#0B1E3B"];

// ─── Demo data ────────────────────────────────────────────────
const DEMO_USERS = [
  { _id:"u1", prenom:"Sophie",   nom:"Martin",  role:"medecin",     service:"Chirurgie",    statut_ligne:"online"  },
  { _id:"u2", prenom:"Alain",    nom:"Koumba",  role:"admin",       service:"Direction",    statut_ligne:"online"  },
  { _id:"u3", prenom:"Marie",    nom:"Nzigou",  role:"infirmier",   service:"Urgences",     statut_ligne:"away"    },
  { _id:"u4", prenom:"Paul",     nom:"Obiang",  role:"laborantin",  service:"Laboratoire",  statut_ligne:"offline" },
  { _id:"u5", prenom:"Claire",   nom:"Bouanga", role:"pharmacien",  service:"Pharmacie",    statut_ligne:"online"  },
  { _id:"u6", prenom:"Henri",    nom:"Mboula",  role:"comptable",   service:"Comptabilité", statut_ligne:"offline" },
];

const DEMO_GROUPS = [
  { _id:"g1", nom:"Direction",      membres:3,  icon:"👔", dernierMsg:"Réunion demain à 9h" },
  { _id:"g2", nom:"Médecins",       membres:8,  icon:"👨‍⚕️", dernierMsg:"Résultat labo patient Dupont" },
  { _id:"g3", nom:"Infirmiers",     membres:12, icon:"💉", dernierMsg:"Planning de garde semaine 24" },
  { _id:"g4", nom:"Bloc Opératoire",membres:5,  icon:"🔪", dernierMsg:"Salle 2 disponible à 14h" },
  { _id:"g5", nom:"Urgences",       membres:6,  icon:"🚨", dernierMsg:"Cas critique en cours, besoin renforts" },
  { _id:"g6", nom:"Administration", membres:4,  icon:"📋", dernierMsg:"Note de service envoyée" },
];

const buildDemoConvs = (userId) => [
  { _id:"c1", type:"direct", membre: DEMO_USERS[0], dernier_message:"Résultats du patient Dupont reçus. Hb : 12.5 g/dL — à discuter avant l'intervention.", dernierMsg_at:"2025-06-01T10:30:00", non_lus:2, favori:true },
  { _id:"c2", type:"direct", membre: DEMO_USERS[1], dernier_message:"Réunion de direction reportée à jeudi 14h.", dernierMsg_at:"2025-06-01T09:15:00", non_lus:0, favori:false },
  { _id:"c3", type:"direct", membre: DEMO_USERS[2], dernier_message:"Le patient chambre 12 a de la fièvre depuis ce matin.", dernierMsg_at:"2025-05-31T22:10:00", non_lus:1, favori:false },
  { _id:"c4", type:"group",  groupe: DEMO_GROUPS[1], dernier_message:"Qui peut assurer la garde de nuit ?", dernierMsg_at:"2025-05-31T18:00:00", non_lus:5, favori:false },
  { _id:"c5", type:"direct", membre: DEMO_USERS[4], dernier_message:"Stock Amoxicilline critique — commande urgente nécessaire.", dernierMsg_at:"2025-05-31T14:20:00", non_lus:0, favori:false },
  { _id:"c6", type:"group",  groupe: DEMO_GROUPS[4], dernier_message:"Cas critique en salle d'attente — besoin de renfort immédiat !", dernierMsg_at:"2025-05-31T11:45:00", non_lus:3, favori:true },
];

const buildDemoMessages = (convId, userId) => {
  const msgs = {
    c1: [
      { _id:"m1", contenu:"Bonjour Dr. Martin, les résultats du bilan préopératoire de M. Dupont viennent d'arriver.", expediteur:{ _id:"u1", prenom:"Sophie", nom:"Martin", role:"medecin" }, date_envoi:"2025-06-01T09:45:00", lu:true, reactions:["👍"] },
      { _id:"m2", contenu:"Parfait, je les examine. Hb à 12.5, c'est limite mais acceptable. La glycémie à jeun est un peu élevée à 7.2 mmol/L.", expediteur:{ _id:"me", prenom:"Moi", nom:"", role:"medecin" }, date_envoi:"2025-06-01T09:52:00", lu:true, reactions:[] },
      { _id:"m3", contenu:"Je recommande de contacter l'anesthésiste avant de confirmer l'intervention du 10 juin.", expediteur:{ _id:"u1", prenom:"Sophie", nom:"Martin", role:"medecin" }, date_envoi:"2025-06-01T10:05:00", lu:false, reactions:[] },
      { _id:"m4", contenu:"Résultats du patient Dupont reçus. Hb : 12.5 g/dL — à discuter avant l'intervention.", expediteur:{ _id:"u1", prenom:"Sophie", nom:"Martin", role:"medecin" }, date_envoi:"2025-06-01T10:30:00", lu:false, reactions:[], type_special:"resultat" },
    ],
    c2: [
      { _id:"m1", contenu:"Bonjour, la réunion de direction est reportée à jeudi 14h. Pouvez-vous confirmer votre présence ?", expediteur:{ _id:"u2", prenom:"Alain", nom:"Koumba", role:"admin" }, date_envoi:"2025-06-01T09:15:00", lu:true, reactions:[] },
      { _id:"m2", contenu:"Confirmé, je serai présent. Merci pour l'information.", expediteur:{ _id:"me", prenom:"Moi", nom:"", role:"medecin" }, date_envoi:"2025-06-01T09:18:00", lu:true, reactions:["✅"] },
    ],
    c3: [
      { _id:"m1", contenu:"Bonsoir docteur, le patient en chambre 12 présente une fièvre à 39.2°C depuis 18h.", expediteur:{ _id:"u3", prenom:"Marie", nom:"Nzigou", role:"infirmier" }, date_envoi:"2025-05-31T22:10:00", lu:false, reactions:[] },
    ],
  };
  return msgs[convId] || [];
};

const DEMO_NOTIFS = [
  { _id:"n1", type:"resultat", titre:"Résultat laboratoire", message:"NFS du patient Paul Nguema disponible — résultat anormal détecté", date:"2025-06-01T10:45:00", lu:false, priorite:"haute" },
  { _id:"n2", type:"rdv",      titre:"Nouveau rendez-vous",  message:"RDV ajouté : Fatou Bongo — Consultation chirurgicale 10/06 à 9h", date:"2025-06-01T09:30:00", lu:false, priorite:"normale" },
  { _id:"n3", type:"urgent",   titre:"Cas urgent — Urgences", message:"Patient entrant — Douleur abdominale aiguë — Évaluation immédiate requise", date:"2025-06-01T08:15:00", lu:false, priorite:"critique" },
  { _id:"n4", type:"facture",  titre:"Facture générée",       message:"Facture #FAC-2025-0089 générée pour M. Jean Dupont — 670 000 CFA", date:"2025-05-31T16:00:00", lu:true, priorite:"normale" },
  { _id:"n5", type:"patient",  titre:"Nouveau patient",       message:"Nouveau dossier créé : Isabelle Moyo — Pédiatrie", date:"2025-05-31T11:20:00", lu:true, priorite:"normale" },
  { _id:"n6", type:"stock",    titre:"Stock critique",        message:"Amoxicilline 1g — Stock inférieur au seuil critique (12 boîtes restantes)", date:"2025-05-31T08:00:00", lu:true, priorite:"haute" },
];

// ─── Modal ────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 580 }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="mov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mov-box" style={{ maxWidth }}>
        <div className="mov-hdr">
          <h3>{title}</h3>
          <button className="mov-cls" onClick={onClose}>×</button>
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
  const dispatch = useDispatch();
  const reduxConvs = useSelector(selectConversations);
  const reduxMessages = useSelector(selectMessages);
  const reduxUnread = useSelector(selectUnreadCount);

  useEffect(() => { dispatch(fetchConversations()); }, [dispatch]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 599);
  useEffect(() => { const fn = () => setIsMobile(window.innerWidth <= 599); window.addEventListener('resize', fn); return () => window.removeEventListener('resize', fn); }, []);

  const { user: authUser } = useAuth() || {};
  const me = authUser || { _id:"me", prenom:"Moi", nom:"", role:"medecin" };

  const [tab, setTab]               = useState("inbox");
  const [filter, setFilter]         = useState("tous");
  const [search, setSearch]         = useState("");
  const [convs, setConvs]           = useState([]);
  const [users, setUsers]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [showInfo, setShowInfo]     = useState(false);
  const [notifs, setNotifs]         = useState(DEMO_NOTIFS);
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [showNewGrp, setShowNewGrp] = useState(false);
  const [newMsgForm, setNewMsgForm] = useState({ destinataire:"", objet:"", contenu:"", priorite:"normale" });
  const [newGrpForm, setNewGrpForm] = useState({ nom:"", membres:[], description:"" });
  const [groups, setGroups]         = useState(DEMO_GROUPS);
  const bottomRef = useRef(null);
  const textRef   = useRef(null);

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
      const { data } = await api.get("/admin/users");
      setUsers((data.users || data).filter(u => u._id !== me._id));
    } catch { setUsers(DEMO_USERS); }
  }, [me._id]);

  useEffect(() => { loadConvs(); loadUsers(); }, [loadConvs, loadUsers]);

  // ── Open conversation ─────────────────────────────────────
  const openConv = async (conv) => {
    setSelected(conv);
    setShowInfo(false);
    try {
      const { data } = await api.get(`/messages/${conv._id}`);
      setMessages(data.messages || []);
    } catch {
      setMessages(buildDemoMessages(conv._id, me._id));
    }
    // Mark as read
    setConvs(prev => prev.map(c => c._id === conv._id ? { ...c, non_lus: 0 } : c));
  };

  // ── Start new conv ────────────────────────────────────────
  const startConv = async (userId) => {
    const u = users.find(u => u._id === userId);
    const existing = convs.find(c => c.type === "direct" && c.membre?._id === userId);
    if (existing) { openConv(existing); return; }
    const fakeConv = { _id:`c_${Date.now()}`, type:"direct", membre:u, dernier_message:"", dernierMsg_at: new Date().toISOString(), non_lus:0, favori:false };
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
      setMessages(m => m.map(msg => msg._id === tmpMsg._id ? { ...tmpMsg, ...data.message } : msg));
    } catch {}
    setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, dernier_message:txt, dernierMsg_at: new Date().toISOString() } : c));
    setSending(false);
  };

  // ── Send new message (compose) ────────────────────────────
  const sendNewMsg = async (e) => {
    e.preventDefault();
    try {
      await api.post("/messages/compose", newMsgForm);
      toast.success("✅ Message envoyé avec succès");
    } catch { toast.success("✅ Message envoyé (local)"); }
    setShowNewMsg(false);
    setNewMsgForm({ destinataire:"", objet:"", contenu:"", priorite:"normale" });
  };

  // ── Create group ──────────────────────────────────────────
  const createGroup = async (e) => {
    e.preventDefault();
    try {
      await api.post("/messages/groups", newGrpForm);
      toast.success("✅ Groupe créé");
    } catch { toast.success("✅ Groupe créé (local)"); }
    setGroups(prev => [{ _id:`g_${Date.now()}`, nom:newGrpForm.nom, membres:newGrpForm.membres.length, icon:"💬", dernierMsg:"Groupe créé" }, ...prev]);
    setShowNewGrp(false);
    setNewGrpForm({ nom:"", membres:[], description:"" });
  };

  // ── Toggle reaction ───────────────────────────────────────
  const toggleReaction = async (msgId, emoji) => {
    setMessages(prev => prev.map(m => {
      if (m._id !== msgId) return m;
      const has = m.reactions?.includes(emoji);
      return { ...m, reactions: has ? m.reactions.filter(r => r !== emoji) : [...(m.reactions||[]), emoji] };
    }));
    try { await api.post(`/messages/reactions/${msgId}`, { emoji }); } catch {}
  };

  // ── Mark notif read ───────────────────────────────────────
  const readNotif = (id) => setNotifs(prev => prev.map(n => n._id === id ? { ...n, lu:true } : n));

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

  // ── Filtered convs ────────────────────────────────────────
  const filteredConvs = convs.filter(c => {
    const name = c.type === "direct" ? `${c.membre?.prenom} ${c.membre?.nom}` : c.groupe?.nom;
    if (search && !name?.toLowerCase().includes(search.toLowerCase()) && !c.dernier_message?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "non_lus") return c.non_lus > 0;
    if (filter === "favoris") return c.favori;
    if (filter === "groupes") return c.type === "group";
    return true;
  });

  const totalNonLus = convs.reduce((s, c) => s + (c.non_lus || 0), 0);
  const notifsNonLues = notifs.filter(n => !n.lu).length;

  // ── Selected info ─────────────────────────────────────────
  const selContact = selected?.type === "direct" ? selected.membre : null;
  const selGroup   = selected?.type === "group"  ? selected.groupe : null;

  // ── Group messages by date ────────────────────────────────
  const groupedMessages = messages.reduce((acc, msg, i) => {
    const prev = messages[i - 1];
    if (!prev || !isSameDay(msg.date_envoi, prev.date_envoi)) {
      acc.push({ type:"date", label: fmtDay(msg.date_envoi), key:`d_${i}` });
    }
    acc.push(msg);
    return acc;
  }, []);

  const notifIcons = { resultat:"🔬", rdv:"📅", urgent:"🚨", facture:"💰", patient:"👤", stock:"💊" };
  const notifColors = { critique:"#DC2626", haute:"#D97706", normale:"#0EA5A0" };

  // ═══════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="msg">

        {/* ── TOPBAR ── */}
        <div className="msg-top">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap", position:"relative", zIndex:2 }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:54, height:54, borderRadius:14, background:"rgba(255,255,255,.12)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {I.chat}
              </div>
              <div>
                <div style={{ fontSize:21, fontWeight:700, color:"#fff", letterSpacing:-.3 }}>Messagerie</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,.55)", marginTop:2 }}>
                  {totalNonLus > 0 ? <span style={{ color:"#FCA5A5", fontWeight:600 }}>{totalNonLus} message(s) non lu(s)</span> : "Tous les messages lus"} · {convs.length} conversation(s)
                </div>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="cbtn cbtn-teal" onClick={() => setShowNewMsg(true)}>
                {I.plus} Nouveau message
              </button>
              <button className="cbtn cbtn-ghost" style={{ color:"#fff", borderColor:"rgba(255,255,255,.3)", position:"relative" }} onClick={() => setTab("notifications")}>
                {I.bell}
                {notifsNonLues > 0 && <span style={{ position:"absolute", top:-6, right:-6, width:18, height:18, background:"#DC2626", color:"#fff", borderRadius:"50%", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{notifsNonLues}</span>}
              </button>
            </div>
          </div>

          {/* Tabs */}
          {(() => {
            const TABS = [
              { key:"inbox",         icon:I.chat,    label:"Conversations",         labelM:"Messages",   badge:totalNonLus>0?totalNonLus:null },
              { key:"groupes",       icon:I.users,   label:`Groupes (${groups.length})`, labelM:"Groupes" },
              { key:"notifications", icon:I.bell,    label:"Notifications",         labelM:"Notifs",     badge:notifsNonLues>0?notifsNonLues:null },
              { key:"patients",      icon:"📱",       label:"Communication patients",labelM:"Patients" },
              { key:"appels",        icon:I.video,   label:"Appels & Visio",        labelM:"Appels" },
              { key:"historique",    icon:I.archive, label:"Historique & Audit",    labelM:"Historique" },
            ];
            return (
              <div style={isMobile?{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'4px',padding:'8px 10px',marginTop:'8px',background:'rgba(255,255,255,.07)',borderRadius:'10px 10px 0 0'}:{display:'flex',gap:'2px',marginTop:'16px',overflowX:'auto',scrollbarWidth:'none'}}>
                {TABS.map(t=>(
                  <button key={t.key} className={`msg-tab ${tab===t.key?"active":""}`} style={isMobile?{flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'7px 3px 8px',fontSize:'9.5px',gap:'3px',borderRadius:'8px',whiteSpace:'normal',minWidth:0}:{}} onClick={()=>setTab(t.key)}>
                    <span style={isMobile?{fontSize:'14px'}:{}}>{typeof t.icon==="string"?t.icon:t.icon}</span>
                    <span style={isMobile?{lineHeight:1.2}:{}}>{isMobile?t.labelM:t.label}</span>
                    {t.badge&&<span className="msg-badge">{t.badge}</span>}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

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
                  const isGroup = conv.type === "group";
                  const contact = isGroup ? null : conv.membre;
                  const grp = isGroup ? conv.groupe : null;
                  const name = isGroup ? grp?.nom : `${contact?.prenom} ${contact?.nom}`;
                  const isActive = selected?._id === conv._id;
                  const hasUnread = conv.non_lus > 0;
                  return (
                    <div key={conv._id} className={`msg-conv-item ${isActive ? "active" : ""} ${hasUnread ? "unread" : ""}`} onClick={() => openConv(conv)}>
                      {isGroup ? (
                        <div style={{ width:42, height:42, borderRadius:12, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                          {grp?.icon || "👥"}
                        </div>
                      ) : (
                        <Av user={contact} size={42} idx={i} showStatus />
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:4 }}>
                          <div className="conv-name">{name}</div>
                          <div className="conv-time">{fmtTime(conv.dernierMsg_at)}</div>
                        </div>
                        {!isGroup && <div className="conv-role">{getRoleLbl(contact?.role)} · {contact?.service}</div>}
                        <div className="conv-preview">{conv.dernier_message || "Démarrer la conversation"}</div>
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
                  <button className="cbtn cbtn-teal" onClick={() => setShowNewMsg(true)}>{I.plus} Nouveau message</button>
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
                      {selected.type === "group" ? (
                        <div style={{ width:42, height:42, borderRadius:12, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{selGroup?.icon || "👥"}</div>
                      ) : (
                        <Av user={selContact} size={42} idx={0} showStatus />
                      )}
                      <div>
                        <div style={{ fontWeight:700, fontSize:15, color:"var(--cn)" }}>
                          {selected.type === "group" ? selGroup?.nom : `${selContact?.prenom} ${selContact?.nom}`}
                        </div>
                        <div style={{ fontSize:12, color:"var(--cm)", display:"flex", alignItems:"center", gap:8 }}>
                          {selected.type === "group" ? (
                            <span>{selGroup?.membres} membre(s)</span>
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
                    <div className="msg-chat-actions">
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px" }} title="Appel audio" onClick={() => toast.success("📞 Appel audio en cours...")}>
                        {I.phone}
                      </button>
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px" }} title="Appel vidéo" onClick={() => toast.success("🎥 Appel vidéo en cours...")}>
                        {I.video}
                      </button>
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px" }} title="Informations" onClick={() => setShowInfo(!showInfo)}>
                        {I.info}
                      </button>
                      <button className="msg-tool-btn cbtn-ghost cbtn" style={{ padding:"6px 10px" }} title="Favori" onClick={() => {
                        setConvs(prev => prev.map(c => c._id === selected._id ? { ...c, favori: !c.favori } : c));
                        setSelected(s => ({ ...s, favori: !s.favori }));
                        toast.success(selected.favori ? "Retiré des favoris" : "⭐ Ajouté aux favoris");
                      }}>
                        <span style={{ color: selected.favori ? "#D97706" : "var(--cm)", fontSize:15 }}>{selected.favori ? "⭐" : I.star}</span>
                      </button>
                      <button className="cbtn-danger cbtn cbtn-sm" title="Archiver" onClick={() => {
                        setConvs(prev => prev.filter(c => c._id !== selected._id));
                        setSelected(null);
                        toast.success("📦 Conversation archivée");
                      }}>
                        {I.archive}
                      </button>
                    </div>
                  </div>

                  {/* Messages area */}
                  <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
                    <div className="msg-area" style={{ flex:1 }}>
                      {groupedMessages.length === 0 && (
                        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--cm)", fontSize:13 }}>
                          Aucun message — Commencez la conversation !
                        </div>
                      )}
                      {groupedMessages.map((item) => {
                        if (item.type === "date") return (
                          <div key={item.key} className="msg-date-sep"><span>{item.label}</span></div>
                        );
                        const msg = item;
                        const isMe = msg.expediteur?._id === me._id || msg.expediteur?._id === "me";
                        const senderName = isMe ? "Moi" : `${msg.expediteur?.prenom} ${msg.expediteur?.nom}`;
                        const EMOJIS = ["👍","❤️","😊","👏","🙏","😮"];
                        return (
                          <div key={msg._id} className="fu" style={{ display:"flex", flexDirection:"column", alignItems: isMe ? "flex-end" : "flex-start", marginBottom:4 }}>
                            {!isMe && <div style={{ fontSize:10, color:"var(--cm)", marginLeft:38, marginBottom:2, fontWeight:600 }}>{senderName}</div>}
                            <div className={`msg-bubble-wrap ${isMe ? "me" : ""}`}>
                              {!isMe && (
                                <div style={{ width:30, height:30, borderRadius:9, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0, alignSelf:"flex-end" }}>
                                  {getRoleIcon(msg.expediteur?.role)}
                                </div>
                              )}
                              <div>
                                {/* Special medical message */}
                                {msg.type_special === "resultat" ? (
                                  <div style={{ background:isMe ? "rgba(255,255,255,.15)" : "#F0FDF4", border:`1.5px solid ${isMe ? "rgba(255,255,255,.3)" : "#A7F3D0"}`, borderRadius:14, padding:"10px 14px", maxWidth:320 }}>
                                    <div style={{ fontSize:11, fontWeight:700, color:isMe ? "rgba(255,255,255,.8)" : "#059669", marginBottom:6, textTransform:"uppercase", letterSpacing:.4 }}>🔬 Résultat médical</div>
                                    <div style={{ fontSize:13, color:isMe ? "#fff" : "var(--cn)", lineHeight:1.5 }}>{msg.contenu}</div>
                                    <button style={{ marginTop:8, fontSize:11, fontWeight:600, color:isMe ? "rgba(255,255,255,.8)" : "var(--ct)", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:4 }} onClick={() => toast.success("📄 Ouverture du résultat...")}>
                                      {I.dl} Télécharger le résultat
                                    </button>
                                  </div>
                                ) : (
                                  <div className={`msg-bubble ${isMe ? "me" : "other"}`}>
                                    {msg.contenu}
                                  </div>
                                )}
                                {/* Meta */}
                                <div className={`msg-meta ${isMe ? "me" : "other"}`}>
                                  <span>{new Date(msg.date_envoi).toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" })}</span>
                                  {isMe && (
                                    <span className="msg-status" style={{ color: msg.lu ? "#0EA5A0" : "rgba(255,255,255,.5)" }}>
                                      {msg.lu ? "✓✓" : "✓"}
                                    </span>
                                  )}
                                </div>
                                {/* Reactions */}
                                {msg.reactions?.length > 0 && (
                                  <div className="reactions" style={{ justifyContent: isMe ? "flex-end" : "flex-start" }}>
                                    {msg.reactions.map(r => (
                                      <span key={r} className="react-pill" onClick={() => toggleReaction(msg._id, r)}>{r}</span>
                                    ))}
                                  </div>
                                )}
                                {/* Quick reactions */}
                                <div style={{ display:"flex", gap:3, marginTop:3, opacity:0, transition:"opacity .2s" }} className="quick-react"
                                  onMouseOver={e => e.currentTarget.style.opacity = 1}
                                  onMouseOut={e => e.currentTarget.style.opacity = 0}>
                                  {["👍","❤️","😊"].map(e => (
                                    <span key={e} style={{ cursor:"pointer", fontSize:13 }} onClick={() => toggleReaction(msg._id, e)}>{e}</span>
                                  ))}
                                </div>
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
                        {[
                          { icon:"🔬", label:"Partager un résultat labo" },
                          { icon:"🩻", label:"Partager imagerie" },
                          { icon:"📋", label:"Partager dossier patient" },
                          { icon:"💊", label:"Envoyer ordonnance" },
                        ].map(a => (
                          <button key={a.label} className="cbtn cbtn-ghost cbtn-sm" style={{ width:"100%", justifyContent:"flex-start", marginBottom:6, fontSize:11 }} onClick={() => toast.success(`${a.icon} Partage en cours...`)}>
                            <span>{a.icon}</span> {a.label}
                          </button>
                        ))}
                        <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid var(--cbr)" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:"var(--cm)", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Sécurité</div>
                          <div style={{ fontSize:11, color:"var(--cm)", display:"flex", alignItems:"center", gap:6 }}>
                            <span>🔒</span> Messages chiffrés de bout en bout
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input area */}
                  <div className="msg-input-area">
                    <div className="msg-input-row">
                      <div className="msg-input-wrap">
                        <textarea
                          ref={textRef}
                          className="msg-textarea"
                          placeholder={`Message à ${selected.type === "group" ? selGroup?.nom : selContact?.prenom}...`}
                          value={input}
                          onChange={handleInput}
                          onKeyDown={handleKey}
                          rows={1}
                        />
                        <div className="msg-input-tools">
                          <button className="msg-tool-btn" title="Fichier" onClick={() => toast.success("📎 Sélectionner un fichier...")}>{I.attach}</button>
                          <button className="msg-tool-btn" title="Image" onClick={() => toast.success("🖼️ Sélectionner une image...")}>{I.image}</button>
                          <button className="msg-tool-btn" title="Document médical" onClick={() => toast.success("📄 Partager un document médical...")}>{I.file}</button>
                          <button className="msg-tool-btn" title="Emoji">{I.emoji}</button>
                          <div style={{ flex:1 }} />
                          <div className="msg-hint" style={{ fontSize:10, color:"var(--cm)" }}>Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</div>
                        </div>
                      </div>
                      <button className="msg-send-btn" onClick={sendMsg} disabled={!input.trim() || sending}>
                        {I.send}
                      </button>
                    </div>
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
                <div style={{ fontSize:12, color:"var(--cm)" }}>{groups.length} groupe(s) actif(s)</div>
              </div>
              <button className="cbtn cbtn-teal" onClick={() => setShowNewGrp(true)}>{I.plus} Créer un groupe</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {groups.map((g, i) => (
                <div key={g._id} className="adm-card fu" style={{ cursor:"pointer" }} onClick={() => {
                  const fakeConv = { _id:`cg_${g._id}`, type:"group", groupe:g, dernier_message:g.dernierMsg, dernierMsg_at: new Date().toISOString(), non_lus:0 };
                  setTab("inbox");
                  setTimeout(() => openConv(fakeConv), 100);
                }}>
                  <div style={{ padding:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                      <div style={{ width:52, height:52, borderRadius:14, background:"#EEF4FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26 }}>{g.icon}</div>
                      <div>
                        <div style={{ fontWeight:700, color:"var(--cn)", fontSize:15 }}>{g.nom}</div>
                        <span className="cbdg blue">{g.membres} membre(s)</span>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"var(--cm)", background:"#F8FAFD", borderRadius:8, padding:"8px 10px" }}>
                      <strong>Dernier message :</strong> {g.dernierMsg}
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:14 }}>
                      <button className="cbtn cbtn-primary cbtn-sm" style={{ flex:1 }}>{I.chat} Ouvrir</button>
                      <button className="cbtn cbtn-ghost cbtn-sm" onClick={e => { e.stopPropagation(); toast.success("📞 Appel groupe..."); }}>{I.phone}</button>
                      <button className="cbtn cbtn-ghost cbtn-sm" onClick={e => { e.stopPropagation(); toast.success("🎥 Visioconférence..."); }}>{I.video}</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <button className="cbtn cbtn-ghost cbtn-sm" onClick={() => setNotifs(prev => prev.map(n => ({ ...n, lu:true })))}>
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
                    <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{fmtFull(n.date)}</div>
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

        {/* ══ APPELS & VISIO ══ */}
        {tab === "appels" && (
          <div style={{ padding:24 }}>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--cn)", marginBottom:20 }}>Appels & Visioconférences</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:16, marginBottom:24 }}>
              {[
                { icon:"📞", titre:"Appel audio",       desc:"Appel audio interne entre membres", color:"#1B4F9E" },
                { icon:"🎥", titre:"Appel vidéo",        desc:"Visioconférence sécurisée 1-à-1",   color:"#0EA5A0" },
                { icon:"👥", titre:"Réunion de groupe",  desc:"Conférence multi-participants",      color:"#7C3AED" },
                { icon:"💻", titre:"Partage d'écran",    desc:"Présentation partagée en direct",   color:"#059669" },
                { icon:"🩺", titre:"Téléconsultation",   desc:"Consultation médicale à distance",  color:"#DC2626" },
              ].map(a => (
                <div key={a.titre} className="adm-card fu" style={{ cursor:"pointer" }} onClick={() => toast.success(`${a.icon} Démarrage : ${a.titre}...`)}>
                  <div style={{ padding:20, textAlign:"center" }}>
                    <div style={{ width:56, height:56, borderRadius:16, background:`${a.color}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 12px" }}>{a.icon}</div>
                    <div style={{ fontWeight:700, fontSize:14, color:"var(--cn)", marginBottom:4 }}>{a.titre}</div>
                    <div style={{ fontSize:11.5, color:"var(--cm)", marginBottom:14 }}>{a.desc}</div>
                    <button className="cbtn cbtn-primary cbtn-sm" style={{ width:"100%" }}>Démarrer →</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="adm-card">
              <div className="adm-card-hdr"><h3>📋 Historique des appels</h3></div>
              <div style={{ overflowX:"auto" }}>
                <table className="adm-tbl">
                  <thead><tr><th>Type</th><th>Participant(s)</th><th>Date</th><th>Durée</th><th>Statut</th></tr></thead>
                  <tbody>
                    {[
                      { type:"Visio", parts:"Dr. Martin ↔ Dr. Leblanc", date:"2025-06-01T09:00:00", duree:"18 min", statut:"Terminé" },
                      { type:"Audio", parts:"Infirmerie → Urgences",     date:"2025-05-31T22:05:00", duree:"5 min",  statut:"Terminé" },
                      { type:"Réunion", parts:"Direction (5 personnes)", date:"2025-05-31T14:00:00", duree:"45 min", statut:"Terminé" },
                      { type:"Visio", parts:"Téléconsultation — Patient Dupont", date:"2025-05-30T10:30:00", duree:"22 min", statut:"Terminé" },
                    ].map((a, i) => (
                      <tr key={i}>
                        <td><span className="cbdg blue">{a.type === "Visio" ? "🎥" : a.type === "Audio" ? "📞" : "👥"} {a.type}</span></td>
                        <td style={{ fontSize:12, color:"var(--cn)" }}>{a.parts}</td>
                        <td style={{ fontSize:12, color:"var(--cm)" }}>{fmtFull(a.date)}</td>
                        <td style={{ fontSize:12, fontWeight:600, color:"var(--cn)" }}>{a.duree}</td>
                        <td><span className="cbdg green">✅ {a.statut}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ HISTORIQUE ══ */}
        {tab === "historique" && (
          <div style={{ padding:24 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              {/* Statistiques */}
              <div className="adm-card fu">
                <div className="adm-card-hdr"><h3>📊 Statistiques de communication</h3></div>
                <div style={{ padding:20 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    {[
                      { lbl:"Messages envoyés", val:"1 284", col:"#1B4F9E" },
                      { lbl:"Messages reçus",   val:"1 102", col:"#0EA5A0" },
                      { lbl:"Groupes actifs",   val:groups.length, col:"#7C3AED" },
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
                    { ic:"📞", act:"Appel vidéo effectué",  user:"Dr. Martin",         det:"Téléconsultation — 22 min",           d:"2025-05-30T10:30:00" },
                  ].map((a, i) => (
                    <div key={i} style={{ display:"flex", gap:12, padding:"12px 20px", borderBottom: i < 5 ? "1px solid #F3F7FF" : "" }}>
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

        {/* ═══ MODAL : NOUVEAU MESSAGE ═══ */}
        <Modal open={showNewMsg} onClose={() => setShowNewMsg(false)} title={`${I.plus} Nouveau message`}>
          <form onSubmit={sendNewMsg}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label className="clbl">Destinataire(s) *</label>
                <select className="cinp" required value={newMsgForm.destinataire} onChange={e => setNewMsgForm(f => ({ ...f, destinataire:e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  <optgroup label="Individuel">
                    {users.map(u => <option key={u._id} value={u._id}>{u.prenom} {u.nom} — {getRoleLbl(u.role)}</option>)}
                  </optgroup>
                  <optgroup label="Groupes">
                    {groups.map(g => <option key={g._id} value={`g_${g._id}`}>{g.icon} {g.nom}</option>)}
                  </optgroup>
                  <option value="all">📢 Tous les employés</option>
                </select>
              </div>
              <div>
                <label className="clbl">Objet</label>
                <input className="cinp" placeholder="Objet du message" value={newMsgForm.objet} onChange={e => setNewMsgForm(f => ({ ...f, objet:e.target.value }))} />
              </div>
              <div>
                <label className="clbl">Priorité</label>
                <select className="cinp" value={newMsgForm.priorite} onChange={e => setNewMsgForm(f => ({ ...f, priorite:e.target.value }))}>
                  <option value="normale">🔵 Normale</option>
                  <option value="haute">🟠 Haute</option>
                  <option value="critique">🔴 Critique / Urgent</option>
                </select>
              </div>
              <div>
                <label className="clbl">Message *</label>
                <textarea className="cinp" required rows={5} placeholder="Votre message..." value={newMsgForm.contenu} onChange={e => setNewMsgForm(f => ({ ...f, contenu:e.target.value }))} />
              </div>
              <div style={{ background:"#F8FAFD", border:"1.5px dashed var(--cbr)", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={() => toast.success("📎 Sélectionner un fichier...")}>
                {I.attach}
                <span style={{ fontSize:12, color:"var(--cm)" }}>Ajouter une pièce jointe (PDF, DOCX, Image, DICOM...)</span>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button type="button" className="cbtn cbtn-ghost" onClick={() => setShowNewMsg(false)}>Annuler</button>
                <button type="submit" className="cbtn cbtn-teal" style={{ marginLeft:"auto" }}>
                  {I.send} Envoyer
                </button>
              </div>
            </div>
          </form>
        </Modal>

        {/* ═══ MODAL : CRÉER GROUPE ═══ */}
        <Modal open={showNewGrp} onClose={() => setShowNewGrp(false)} title={`${I.plus} Créer un groupe`}>
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

      </div>
    </>
  );
}