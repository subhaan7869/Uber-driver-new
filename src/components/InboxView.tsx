import React, { useState } from 'react';
import {
  ChevronLeft,
  FileCheck,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { InboxThread } from '../types/driver';

interface InboxViewProps {
  threads: InboxThread[];
  onBack: () => void;
  onMarkRead: (threadId: string) => void;
  onReplyThread: (threadId: string, text: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  threads,
  onBack,
  onMarkRead,
  onReplyThread,
}) => {
  const [subTab, setSubTab] = useState<'notifications' | 'support'>('support');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const notifUnread = threads.filter((t) => t.tab === 'notifications' && t.unread).length;
  const supportUnread = threads.filter((t) => t.tab === 'support' && t.unread).length;

  const filteredThreads = threads.filter((t) => t.tab === subTab);
  const selectedThread = threads.find((t) => t.id === activeThreadId) || null;

  const renderRowIcon = (type: InboxThread['iconType']) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-black fill-black" />;
      case 'mail':
        return <Mail className="w-5 h-5 text-black fill-black/85" />;
      case 'doc':
        return <FileCheck className="w-5 h-5 text-[#05944F]" />;
      case 'promo':
        return <Sparkles className="w-5 h-5 text-[#276EF1]" />;
    }
  };

  const handleOpenThread = (thread: InboxThread) => {
    if (thread.unread) onMarkRead(thread.id);
    setActiveThreadId(thread.id);
  };

  const handleSendReply = () => {
    if (!selectedThread || !replyText.trim()) return;
    onReplyThread(selectedThread.id, replyText.trim());
    setReplyText('');
  };

  if (selectedThread) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
        <div className="px-4 pt-15 lg:pt-3.5 pb-3.5 border-b border-[#EEEEEE] flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveThreadId(null)}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Back to Inbox"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold text-black truncate">
              {selectedThread.title}
            </h2>
            <p className="text-[12px] text-[#545454]">Uber Support · {selectedThread.timeAgo}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFAFA]">
          {selectedThread.messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                msg.sender === 'driver'
                  ? 'ml-auto bg-black text-white'
                  : 'bg-white border border-[#E6E6E6] text-black'
              }`}
            >
              <p>{msg.text}</p>
              <p
                className={`text-[11px] mt-1 ${
                  msg.sender === 'driver' ? 'text-white/65' : 'text-[#757575]'
                }`}
              >
                {msg.timestamp}
              </p>
            </div>
          ))}
        </div>

        <div className="p-3 bg-white border-t border-[#EEEEEE] flex items-center gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
            placeholder="Reply to Uber Support..."
            className="flex-1 h-11 px-4 rounded-xl bg-[#F3F3F3] text-[14px] text-black placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="button"
            onClick={handleSendReply}
            className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center hover:bg-neutral-800 transition-colors shrink-0"
            aria-label="Send support reply"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white">
      <div className="px-5 pt-15 lg:pt-6 pb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center justify-center transition-all shrink-0"
          aria-label="Back to Map"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <h1 className="text-[32px] font-extrabold tracking-tight text-black">
          Inbox
        </h1>
      </div>

      {/* Sub-Tabs (1:1 Match to Image 6) */}
      <div className="grid grid-cols-2 border-b border-[#EEEEEE]">
        <button
          type="button"
          onClick={() => setSubTab('notifications')}
          className={`relative py-3.5 flex items-center justify-center gap-2 text-[15px] font-bold transition-colors ${
            subTab === 'notifications' ? 'text-black' : 'text-[#6B6B6B] hover:text-black'
          }`}
        >
          <span>Notifications</span>
          {notifUnread > 0 && (
            <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#276EF1] text-white text-[12px] font-bold flex items-center justify-center tabular-nums">
              {notifUnread}
            </span>
          )}
          {subTab === 'notifications' && (
            <span className="absolute bottom-0 inset-x-0 h-[3px] bg-black" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('support')}
          className={`relative py-3.5 flex items-center justify-center gap-2 text-[15px] font-bold transition-colors ${
            subTab === 'support' ? 'text-black' : 'text-[#6B6B6B] hover:text-black'
          }`}
        >
          <span>Support</span>
          {supportUnread > 0 && (
            <span className="min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#276EF1] text-white text-[12px] font-bold flex items-center justify-center tabular-nums">
              {supportUnread}
            </span>
          )}
          {subTab === 'support' && (
            <span className="absolute bottom-0 inset-x-0 h-[3px] bg-black" />
          )}
        </button>
      </div>

      <div className="px-5 pt-5 pb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight text-black mb-3">
          {subTab === 'support' ? 'Active' : 'Updates'}
        </h2>

        <div className="divide-y divide-[#EEEEEE]">
          {filteredThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleOpenThread(thread)}
              className="w-full py-4 flex items-start gap-4 text-left hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-8 h-8 flex items-center justify-center mt-0.5 shrink-0">
                {renderRowIcon(thread.iconType)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[16px] font-bold text-black leading-snug">
                    {thread.title}
                  </p>
                  <span className="text-[13px] text-[#6B6B6B] whitespace-nowrap shrink-0">
                    {thread.timeAgo}
                  </span>
                </div>
                <p className="text-[14px] text-[#545454] truncate mt-1">
                  {thread.preview}
                </p>
                {thread.statusText && (
                  <p className="text-[14px] font-semibold text-[#276EF1] mt-1.5">
                    {thread.statusText}
                  </p>
                )}
              </div>

              <div className="w-4 flex items-center justify-center pt-5 shrink-0">
                {thread.unread && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#276EF1]" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
