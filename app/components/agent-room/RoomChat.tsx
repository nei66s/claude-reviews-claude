
"use client";

import React, { useRef, useEffect } from "react";
import MessageBubble from "../MessageBubble";
import { Message } from "../../lib/api";
import { Users } from "lucide-react";

interface RoomChatProps {
  messages: Message[];
  isThinking: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function RoomChat({ messages, isThinking, messagesEndRef }: RoomChatProps) {
  return (
    <section className="room-chat">
      <div className="chat-viewport">
        <div className="message-wall">
          {messages.length === 0 ? (
            <div className="room-empty">
              <div className="empty-icon text-indigo-500/20">
                <Users size={64} />
              </div>
              <h2>A família está a caminho...</h2>
              <p>Reunindo todos na sala de convivência.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div 
                key={msg.id || `msg-${idx}`} 
                className={`bubble-container ${msg.id?.startsWith("sys-") ? "is-system" : ""} ${msg.agentId === "urubudopix" ? "is-urubu" : ""}`}
              >
                <div className="bubble-wrapper">
                  <MessageBubble message={msg} />
                </div>
              </div>
            ))
          )}
          {isThinking && (
            <div className="thinking-indicator">
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <style jsx>{`
        .room-chat {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: radial-gradient(circle at 70% 30%, rgba(79, 70, 229, 0.04), transparent 50%),
                      radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.02), transparent 40%);
          min-width: 0;
          position: relative;
        }

        .chat-viewport {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 40px 32px;
          scroll-behavior: smooth;
        }

        /* Custom Scrollbar */
        .chat-viewport::-webkit-scrollbar { width: 6px; }
        .chat-viewport::-webkit-scrollbar-track { background: transparent; }
        .chat-viewport::-webkit-scrollbar-thumb { 
          background: rgba(255, 255, 255, 0.05); 
          border-radius: 3px; 
        }
        .chat-viewport::-webkit-scrollbar-thumb:hover { 
          background: rgba(255, 255, 255, 0.1); 
        }

        .message-wall {
          max-width: 850px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .bubble-container {
          width: 100%;
          perspective: 1000px;
        }

        .bubble-wrapper {
          animation: slide-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-origin: center left;
        }

        @keyframes slide-in {
          from { opacity: 0; transform: translateY(20px) rotateX(-10deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0); }
        }

        .bubble-container.is-system {
          display: flex;
          justify-content: center;
          margin: 12px 0;
        }

        .is-system :global(.bubble) {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.06) !important;
          padding: 8px 18px !important;
          border-radius: 20px !important;
          font-size: 11px !important;
          color: #888 !important;
          backdrop-filter: blur(8px);
          max-width: 90% !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .bubble-container.is-urubu {
          animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }

        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .room-empty {
          margin-top: 15vh;
          text-align: center;
          color: #444;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .empty-icon {
          animation: floating 3s infinite ease-in-out;
        }

        @keyframes floating {
          from { transform: translateY(0); }
          to { transform: translateY(-15px); }
        }

        .room-empty h2 {
          font-size: 20px;
          font-weight: 800;
          color: #666;
          margin: 0;
        }

        .room-empty p {
          font-size: 14px;
          color: #444;
        }

        .thinking-indicator {
          display: flex;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px 18px 18px 4px;
          width: fit-content;
          margin-top: 8px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .typing-dots {
          display: flex;
          gap: 6px;
        }

        .typing-dots span {
          width: 7px;
          height: 7px;
          background: #444;
          border-radius: 50%;
          animation: blink-dot 1.2s infinite;
        }

        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes blink-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        @media (max-width: 640px) {
          .chat-viewport { padding: 20px 16px; }
        }
      `}</style>
    </section>
  );
}
