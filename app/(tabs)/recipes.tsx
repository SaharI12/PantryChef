import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, query, getDocs, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// --- CONFIGURATION ---
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface InventoryItem {
  name: string;
  category: string;
  quantity: number;
  unit: string;
}

const SUGGESTION_PROMPTS = [
  "Quick breakfast ideas 🍳",
  "Healthy lunch options 🥗",
  "Easy dinner recipes 🍝",
  "Vegetarian meals 🥕",
];

export default function RecipesScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch user's inventory on mount
  useEffect(() => {
    if (user) {
      loadInventory();
      loadChatHistory();
    }
  }, [user]);

  const loadInventory = async () => {
    if (!user) return;

    try {
      setInventoryLoading(true);
      const inventoryRef = collection(db, `users/${user.uid}/inventory`);
      const q = query(inventoryRef);
      const snapshot = await getDocs(q);

      const items: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          unit: data.unit,
        });
      });

      setInventory(items);
      setInventoryLoading(false);

      // Add welcome message if first time
      if (messages.length === 0) {
        addWelcomeMessage(items);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      setInventoryLoading(false);
    }
  };

  const loadChatHistory = async () => {
    if (!user) return;

    try {
      const historyRef = collection(db, `users/${user.uid}/chat_history`);
      const q = query(historyRef, orderBy('timestamp', 'desc'), limit(20));
      const snapshot = await getDocs(q);

      const history: any[] = [];
      snapshot.forEach((doc) => {
        history.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const addWelcomeMessage = (items: InventoryItem[]) => {
    const itemCount = items.length;
    const welcomeMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `👨‍🍳 Hello! I'm your AI Chef. I can see you have ${itemCount} items in your pantry. What would you like to cook today? I can suggest recipes based on your dietary preferences, cooking time, or meal type!`,
      timestamp: new Date(),
    };
    setMessages([welcomeMsg]);
  };

  const formatInventoryForPrompt = () => {
    if (inventory.length === 0) {
      return "The user currently has no items in their inventory.";
    }

    return inventory
      .map(item => `${item.name} (${item.quantity} ${item.unit})`)
      .join(', ');
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || userInput.trim();
    if (!textToSend || loading) return;

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setLoading(true);

    try {
      // Build conversation context (only last 6 messages to save tokens)
      const recentMessages = [...messages, userMsg].slice(-6);
      const conversationHistory = recentMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Chef'}: ${msg.content}`)
        .join('\n\n');

      // System prompt with inventory
      const systemPrompt = `You are an outstanding professional chef with years of experience.

AVAILABLE INGREDIENTS:
${formatInventoryForPrompt()}

YOUR ROLE:
- Create personalized recipes based on the user's available ingredients
- Suggest recipes according to their preferences (dietary restrictions, meal type, cooking time, etc.)
- Be conversational, friendly, and helpful
- Provide clear, step-by-step instructions
- Include cooking times and serving sizes
- Suggest alternatives if they're missing key ingredients
- If they ask for modifications, adjust the recipe accordingly

IMPORTANT:
- Prioritize using ingredients from their inventory
- If a recipe needs ingredients they don't have, mention it and suggest substitutions
- Keep recipes practical and achievable
- Format recipes clearly with ingredients list and numbered steps

CONVERSATION HISTORY:
${conversationHistory}

Now respond to the user's latest message naturally and helpfully.`;

      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: {
          temperature: 0.7,
        }
      });
      const result = await model.generateContent(systemPrompt);
      const response = result.response.text();

      // Add AI response
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);

      // Save conversation to Firebase for history (optional)
      if (user) {
        await saveChatToHistory(userMsg, aiMsg);
      }

      setLoading(false);

      // Auto-scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error: any) {
      console.error('Error calling Gemini API:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to get recipe. Please try again.');
    }
  };

  const saveChatToHistory = async (userMsg: Message, aiMsg: Message) => {
    if (!user) return;

    try {
      const chatRef = collection(db, `users/${user.uid}/chat_history`);
      await addDoc(chatRef, {
        user_message: userMsg.content,
        ai_message: aiMsg.content,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const clearChat = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to start a new conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            addWelcomeMessage(inventory);
          },
        },
      ]
    );
  };

  const handleSuggestionPress = (suggestion: string) => {
    // Remove emoji and send
    const cleanText = suggestion.replace(/[^\w\s]/gi, '').trim();
    sendMessage(cleanText);
  };

  const handleKeyPress = (e: any) => {
    // Send on Enter, add new line on Shift+Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  if (inventoryLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Loading your pantry...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={toggleHistory} style={styles.menuButton}>
            <MaterialIcons name="menu" size={28} color="#4A90E2" />
          </TouchableOpacity>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>👨‍🍳 Your AI Chef</Text>
            <Text style={styles.headerSubtitle}>
              {inventory.length} ingredients available
            </Text>
          </View>
          <TouchableOpacity onPress={clearChat} style={styles.clearButton}>
            <MaterialIcons name="refresh" size={24} color="#4A90E2" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.userText : styles.aiText,
                ]}
              >
                {message.content}
              </Text>
            </View>
          ))}

          {loading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <ActivityIndicator size="small" color="#4A90E2" />
              <Text style={styles.loadingMessageText}>Chef is thinking...</Text>
            </View>
          )}

          {/* Suggestion Chips (only show at start) */}
          {messages.length <= 1 && !loading && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Try asking:</Text>
              <View style={styles.suggestionsGrid}>
                {SUGGESTION_PROMPTS.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() => handleSuggestionPress(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask for a recipe... (Enter to send)"
            placeholderTextColor="#999"
            value={userInput}
            onChangeText={setUserInput}
            onSubmitEditing={() => sendMessage()}
            onKeyPress={handleKeyPress}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!userInput.trim() || loading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!userInput.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Hamburger Sidebar Modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent={true}
        onRequestClose={toggleHistory}
      >
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPress={toggleHistory}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.sidebar}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>📜 Chat History</Text>
              <TouchableOpacity onPress={toggleHistory}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sidebarContent}>
              {chatHistory.length === 0 ? (
                <Text style={styles.emptyHistoryText}>No previous chats yet</Text>
              ) : (
                chatHistory.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.historyItem}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.historyUserMsg} numberOfLines={2}>
                      You: {chat.user_message}
                    </Text>
                    <Text style={styles.historyAiMsg} numberOfLines={3}>
                      Chef: {chat.ai_message}
                    </Text>
                    <Text style={styles.historyTimestamp}>
                      {chat.timestamp?.toDate().toLocaleDateString()}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  menuButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4A90E2',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  loadingMessageText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  suggestionsContainer: {
    marginTop: 20,
  },
  suggestionsTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    fontWeight: '600',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  suggestionText: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#4A90E2',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
  },
  sidebar: {
    width: '80%',
    maxWidth: 350,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sidebarContent: {
    flex: 1,
    padding: 15,
  },
  emptyHistoryText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 40,
  },
  historyItem: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  historyUserMsg: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
  },
  historyAiMsg: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 8,
  },
  historyTimestamp: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
});
