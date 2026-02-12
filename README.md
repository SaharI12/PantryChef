# 🍳 PantryChef

**PantryChef** is a smart pantry management app powered by AI that helps you track your food inventory, reduce waste, and discover recipes based on what you have at home.

🌐 **Live App**: [https://mypantrey.netlify.app](https://mypantrey.netlify.app)

## ✨ Features

### 📸 Smart Inventory Management
- **AI-Powered Image Recognition**: Take photos or upload images of your groceries and let AI automatically identify and add items to your inventory
- **Drag & Drop Support**: Easy file upload on web with drag-and-drop functionality
- **Manual Entry**: Add items manually with detailed information (name, quantity, unit, category, expiration date)
- **Category Filtering**: Organize items by Pantry, Fridge, or Freezer
- **Expiration Tracking**: Keep track of expiration dates with visual indicators

### 👨‍🍳 AI Chef Assistant
- **Conversational AI**: Chat with your personal AI chef powered by Google Gemini
- **Inventory-Aware Recipes**: Get recipe suggestions based on ingredients you actually have
- **Dietary Preferences**: Request recipes that match your dietary needs
- **Chat History**: Access previous conversations in the hamburger sidebar
- **Token Optimization**: Efficient API usage by sending only recent context

### 📊 Usage Tracking
- **"I Used" Feature**: Track ingredient consumption with +/- buttons
- **Auto-Delete**: Items automatically removed when quantity reaches zero
- **Validation**: Prevents usage from exceeding available quantity

### 🔐 Authentication
- **Google Sign-In**: Quick OAuth authentication
- **Email/Password**: Traditional authentication method
- **Secure Storage**: User data stored in Firebase Firestore

### 🌐 Cross-Platform
- **Web**: Fully functional progressive web app
- **iOS**: Native mobile experience via Expo
- **Android**: Native mobile experience via Expo

## 🚀 Getting Started

### Prerequisites
- Node.js 20 or higher
- npm or yarn
- Expo CLI (optional for mobile development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd PantryChef
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Add your API keys:
   ```
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```

   Get your Gemini API key from: [Google AI Studio](https://makersuite.google.com/app/apikey)

4. **Configure Firebase**

   Update `firebaseConfig.ts` with your Firebase project credentials from the [Firebase Console](https://console.firebase.google.com/)

### Running the App

#### Development Mode
```bash
npx expo start
```

Choose your platform:
- Press `w` for web
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

#### Web Build
```bash
npx expo export -p web
```

The web build will be generated in the `dist` folder.

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) / React Native
- **Language**: TypeScript
- **Routing**: Expo Router (file-based routing)
- **AI**: Google Gemini API
- **Backend**: Firebase (Authentication + Firestore)
- **Image Recognition**: Google Gemini Vision
- **Deployment**: Netlify
- **Styling**: React Native StyleSheet

## 📁 Project Structure

```
PantryChef/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Inventory screen
│   │   ├── camera.tsx         # Image capture & AI recognition
│   │   └── recipes.tsx        # AI Chef chat interface
│   ├── context/
│   │   └── AuthContext.tsx    # Authentication context
│   └── login.tsx              # Login/Registration screen
├── firebaseConfig.ts          # Firebase configuration
├── netlify.toml              # Netlify deployment config
├── .env                      # Environment variables (not committed)
├── .env.example             # Environment variables template
└── package.json
```

## 🔑 Key Features Explained

### AI Image Recognition
The camera feature uses Google Gemini's vision capabilities to:
1. Analyze images of grocery items
2. Extract item names, quantities, and categories
3. Present results in an editable confirmation modal
4. Save multiple items to inventory at once

### AI Chef
The recipes screen provides:
- Context-aware recipe suggestions based on your inventory
- Natural conversation flow
- Efficient token usage (last 6 messages sent to API)
- Full chat history stored in Firebase
- Quick suggestion chips for common requests

### Usage Tracking
The "I Used" feature allows you to:
- See all inventory items in one modal
- Adjust quantities with +/- buttons
- Input custom amounts
- Automatically delete items that reach zero quantity

## 🚢 Deployment

The app is deployed on Netlify and configured via `netlify.toml`:
- Build command: `npx expo export -p web`
- Publish directory: `dist`
- Node version: 20
- SPA redirect rules configured

**Important**: Don't forget to add your Netlify domain to Firebase authorized domains in the Firebase Console under Authentication → Settings → Authorized domains.

## 🔐 Security Notes

- API keys are stored in `.env` and not committed to git
- `.env` is listed in `.gitignore`
- Use `.env.example` as a template for setting up your own environment
- Firebase security rules should be configured in the Firebase Console

## 🤝 Contributing

Feel free to open issues or submit pull requests for improvements!

## 📝 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- AI powered by [Google Gemini](https://ai.google.dev)
- Backend by [Firebase](https://firebase.google.com)
- Deployed on [Netlify](https://www.netlify.com)
