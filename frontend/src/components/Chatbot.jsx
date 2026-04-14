import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useAnalytics } from '../context/AnalyticsContext';
import { auth } from '../services/firebase';

const BACKEND_URL = ''; // Now handled by Vite proxy in vite.config.js

const QUICK_ACTIONS = [
  { label: '☕ Coffee sales?', message: 'How are my Coffee Beans selling recently?' },
  { label: '📦 Low stock?', message: 'Which products (like Green Tea or Bars) are low on stock?' },
  { label: '📊 Sales trend?', message: 'What is my recent sales trend for this month?' },
  { label: '🔮 Forecast?', message: 'What are the predicted sales for next week?' },
  { label: '🚨 Alerts?', message: 'Are there any active alerts for Coffee or Tea?' },
  { label: '📋 Business Summary', message: 'Give me a full overview of how my Coffee & Tea business is doing.' }
];

function TypingIndicator() {
  return (
    <div className="chatbot-typing-indicator">
      <span />
      <span />
      <span />
    </div>
  );
}

function formatMarkdown(text) {
  if (!text) return '';

  let html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n/g, '<br/>');

  html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
    return `<ul class="chatbot-list">${match}</ul>`;
  });

  return html;
}

function MessageBubble({ msg, index }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className={`chatbot-message ${isUser ? 'chatbot-message-user' : 'chatbot-message-ai'}`}
    >
      {!isUser && (
        <div className="chatbot-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
      )}
      <div
        className={`chatbot-bubble ${isUser ? 'chatbot-bubble-user' : 'chatbot-bubble-ai'}`}
        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
      />
    </motion.div>
  );
}

export default function Chatbot() {
  const { user, isAuthenticated } = useAuth();
  const { cachedAnalytics } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "👋 Hi! I'm your **AI Business Assistant**. I have access to your data for **Coffee Beans**, **Green Tea**, and other products.\n\nAsk me about your top sellers or try one of the quick actions below!"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isAuthenticated) return null;

  async function getAuthToken() {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
    } catch (error) {
      console.error('[Chatbot] Failed to get auth token:', error);
    }
    return null;
  }

  async function sendMessage(messageText) {
    if (!messageText?.trim() || isLoading) return;

    const trimmed = messageText.trim();
    setShowQuickActions(false);

    const userMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getAuthToken();

      if (!token) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠️ Authentication error. Please try logging in again.' }
        ]);
        setIsLoading(false);
        return;
      }

      const conversationHistory = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch(`${BACKEND_URL}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory,
          analyticsContext: cachedAnalytics
        })
      });

      const data = await response.json();

      if (data.success && data.data?.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.data.reply }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message || 'Sorry, I couldn\'t process your request. Please try again.'
          }
        ]);
      }
    } catch (error) {
      console.error('[Chatbot] Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Failed to connect to the server. Please make sure the backend is running.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleQuickAction(action) {
    sendMessage(action.message);
  }

  function clearConversation() {
    setMessages([
      {
        role: 'assistant',
        content:
          "🔄 Conversation cleared! Ask me anything about your business data."
      }
    ]);
    setShowQuickActions(true);
  }

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chatbot-fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="chatbot-fab"
            id="chatbot-fab-button"
            aria-label="Open AI Assistant"
          >
            <div className="chatbot-fab-inner">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="chatbot-fab-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chatbot-panel"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="chatbot-panel"
            id="chatbot-panel"
          >
            {/* Header */}
            <div className="chatbot-header">
              <div className="chatbot-header-info">
                <div className="chatbot-header-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h3 className="chatbot-header-title">AI Business Assistant</h3>
                  <div className="chatbot-header-status">
                    <span className="chatbot-status-dot" />
                    Online • Analyzing your data
                  </div>
                </div>
              </div>

              <div className="chatbot-header-actions">
                <button
                  onClick={clearConversation}
                  className="chatbot-header-btn"
                  title="Clear chat"
                  aria-label="Clear conversation"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="chatbot-header-btn"
                  title="Minimize"
                  aria-label="Minimize chat"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="chatbot-messages" id="chatbot-messages-container">
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} msg={msg} index={idx} />
              ))}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="chatbot-message chatbot-message-ai"
                >
                  <div className="chatbot-avatar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div className="chatbot-bubble chatbot-bubble-ai">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <AnimatePresence>
              {showQuickActions && messages.length <= 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="chatbot-quick-actions"
                >
                  {QUICK_ACTIONS.map((action, idx) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleQuickAction(action)}
                      className="chatbot-quick-chip"
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div className="chatbot-input-area">
              <div className="chatbot-input-wrapper">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your business..."
                  className="chatbot-input"
                  id="chatbot-input-field"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="chatbot-send-btn"
                  id="chatbot-send-button"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
              <p className="chatbot-disclaimer">AI responses are based on your uploaded business data</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
