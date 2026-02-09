import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, Ionicons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db } from '../../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// --- CONFIGURATION ---
const API_KEY = "AIzaSyAAmDr6-ZU8KVdYFJCuJA6sHXQ9w3dJGbY";
const genAI = new GoogleGenerativeAI(API_KEY);

interface ScannedItem {
  id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  expirationDate?: Date | null;
}

const CATEGORIES = ['Pantry', 'FruitVeg', 'Freezer', 'Refrigerator'];
const UNITS = ['units', 'kg', 'g', 'L'];

export default function CameraScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [facing, setFacing] = useState<CameraType>('back');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);

  // Mobile Picker State
  const [showGlobalDatePicker, setShowGlobalDatePicker] = useState(false);
  const [activeDateId, setActiveDateId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setCameraActive(false);
        setCapturedImage(null);
        setBase64Data(null);
        setLoading(false);
        setStatus("");
        setConfirmModalVisible(false);
        setScannedItems([]);
        setShowGlobalDatePicker(false);
        setEditingNameId(null);
        setActiveDateId(null);
      };
    }, [])
  );

  const ensureBase64 = async (uri: string, existingBase64: string | null) => {
    if (existingBase64) return existingBase64;
    setStatus("Converting image format...");
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Conversion failed:", e);
      return null;
    }
  };

  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission", "Camera access is needed.");
        return;
      }
    }
    setCameraActive(true);
  };

  const handlePickImage = async () => {
    setStatus("Opening gallery...");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setCapturedImage(result.assets[0].uri);
      setBase64Data(result.assets[0].base64 || null);
      setCameraActive(false);
      setStatus("✅ Image loaded! Ready to Identify.");
    } else {
      setStatus("");
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        setCapturedImage(photo?.uri || null);
        setBase64Data(photo?.base64 || null);
        setCameraActive(false);
        setStatus("✅ Photo captured! Ready to Identify.");
      } catch (error) {
        Alert.alert("Error", "Failed to capture image.");
      }
    }
  };

  const analyzeImage = async () => {
    if (API_KEY.includes("YOUR_API_KEY")) {
      Alert.alert("Error", "Check API Key in camera.tsx");
      return;
    }
    if (!capturedImage) {
      Alert.alert("Error", "No image selected!");
      return;
    }
    setLoading(true);
    setStatus("Preparing image data...");

    try {
      const finalBase64 = await ensureBase64(capturedImage, base64Data);
      if (!finalBase64) throw new Error("Could not process image data.");

      setStatus("📡 Sending to Gemini AI...");
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

      const prompt = `
        Analyze this food image. Identify ALL food items visible.
        Return a STRICT JSON ARRAY of objects. Do not use Markdown.
        Example format: [{"name": "Apple", "category": "FruitVeg", "quantity": 1, "unit": "units", "shelf_life_days": 14}]
        Categories: [Pantry, FruitVeg, Freezer, Refrigerator].
        shelf_life_days should be an integer estimate.
      `;

      const cleanData = finalBase64.replace(/^data:image\/\w+;base64,/, "");
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: cleanData, mimeType: "image/jpeg" } }
      ]);

      setStatus("🧠 AI is thinking...");
      const responseText = result.response.text();

      setStatus("Parsing results...");
      const firstBracket = responseText.indexOf('[');
      const lastBracket = responseText.lastIndexOf(']');
      if (firstBracket === -1) throw new Error("Invalid AI Response (No JSON found)");

      const cleanJson = responseText.substring(firstBracket, lastBracket + 1);
      let parsedItems = JSON.parse(cleanJson);
      if (!Array.isArray(parsedItems)) parsedItems = [parsedItems];

      const formattedItems = parsedItems.map((item: any, index: number) => {
        const now = new Date();
        const days = item.shelf_life_days || 7;
        const estimatedDate = new Date();
        estimatedDate.setDate(now.getDate() + days);

        return {
          ...item,
          id: index.toString(),
          quantity: item.quantity ? item.quantity.toString() : "1",
          expirationDate: estimatedDate,
        };
      });

      setScannedItems(formattedItems);
      setLoading(false);
      setStatus("");
      setConfirmModalVisible(true);
    } catch (error: any) {
      setLoading(false);
      console.error(error);
      setStatus("❌ Error: " + (error.message || "Failed"));
      Alert.alert("AI Error", error.message || "Something went wrong");
    }
  };

  const saveAllItems = async () => {
    if (!user) return;
    setLoading(true);
    setStatus("Saving to database...");

    try {
      const batchPromises = scannedItems.map((item) => {
        const expirationTimestamp = item.expirationDate
          ? Timestamp.fromDate(item.expirationDate)
          : null;

        return addDoc(collection(db, `users/${user.uid}/inventory`), {
          name: item.name,
          category: item.category,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit,
          created_at: Timestamp.now(),
          expiration_date: expirationTimestamp,
        });
      });

      await Promise.all(batchPromises);

      setLoading(false);
      setStatus("");
      setConfirmModalVisible(false);
      setCapturedImage(null);
      setBase64Data(null);
      Alert.alert("Success", "Items saved successfully!", [
        { text: "OK", onPress: () => router.push('/(tabs)') }
      ]);
    } catch (error) {
      setLoading(false);
      setStatus("Error saving items");
      Alert.alert("Error", "Could not save items.");
    }
  };

  const updateItem = (id: string, field: keyof ScannedItem, value: any) => {
    setScannedItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const deleteScannedItem = (id: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowGlobalDatePicker(false);

    if (activeDateId && selectedDate) {
       updateItem(activeDateId, 'expirationDate', selectedDate);
       if (Platform.OS !== 'web') {
         setActiveDateId(null);
         setShowGlobalDatePicker(false);
       }
    }
  };

  // Mobile Trigger
  const triggerDateEdit = (id: string) => {
    setActiveDateId(id);
    if (Platform.OS !== 'web') {
      setShowGlobalDatePicker(true);
    }
  };

  // Format date for display
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Tap to set';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // --- RENDER ---
  if (capturedImage && !confirmModalVisible) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        <View style={styles.statusOverlay}><Text style={styles.statusText}>{status}</Text></View>
        {loading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#4A90E2" /><Text style={styles.loadingText}>{status}</Text></View>}
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCapturedImage(null); setBase64Data(null); setStatus(""); }}>
             <Ionicons name="close" size={24} color="#fff" />
             <Text style={styles.btnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.analyzeBtn} onPress={analyzeImage}>
            <MaterialIcons name="auto-awesome" size={24} color="#fff" />
            <Text style={styles.btnText}>Identify</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cameraActive) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.closeCameraBtn} onPress={() => setCameraActive(false)}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
                <Ionicons name="camera-reverse-outline" size={30} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 30 }} />
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.menuContainer}>
      {!confirmModalVisible && (
        <>
          <Text style={styles.title}>Add Groceries</Text>
          <Text style={styles.subtitle}>Choose how to add items</Text>
          {status !== "" && <Text style={styles.menuStatus}>{status}</Text>}
          <View style={styles.optionsGrid}>
            <TouchableOpacity style={styles.optionCard} onPress={handleOpenCamera}>
              <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="camera" size={40} color="#4A90E2" />
              </View>
              <Text style={styles.optionTitle}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionCard} onPress={handlePickImage}>
              <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                <FontAwesome5 name="images" size={35} color="#4CAF50" />
              </View>
              <Text style={styles.optionTitle}>Upload File</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* --- CONFIRMATION MODAL --- */}
      <Modal visible={confirmModalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirm Items</Text>
            <TouchableOpacity onPress={() => setConfirmModalVisible(false)}>
              <Text style={{color: '#FF3B30', fontSize: 16}}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={scannedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{padding: 20, paddingBottom: 100}}
            renderItem={({ item }) => (
              <View style={styles.editCard}>

                {/* 1. NAME EDIT ROW */}
                <View style={styles.editCardHeader}>
                  {editingNameId === item.id ? (
                    <View style={styles.nameEditBar}>
                      <TextInput
                        style={styles.nameInputActive}
                        value={item.name}
                        autoFocus={true}
                        onChangeText={(text) => updateItem(item.id, 'name', text)}
                      />
                      <TouchableOpacity onPress={() => setEditingNameId(null)} style={styles.checkBtn}>
                        <Ionicons name="checkmark-circle" size={28} color="#4CAF50" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.nameDisplayBar}>
                      <Text style={styles.nameText}>{item.name}</Text>
                      <TouchableOpacity onPress={() => setEditingNameId(item.id)} style={{marginLeft: 10}}>
                        <MaterialIcons name="edit" size={22} color="#4A90E2" />
                      </TouchableOpacity>
                      <View style={{flex:1}} />
                      <TouchableOpacity onPress={() => deleteScannedItem(item.id)}>
                        <MaterialIcons name="cancel" size={24} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 2. QUANTITY & UNIT */}
                <Text style={styles.label}>Amount:</Text>
                <View style={styles.row}>
                    <TextInput
                      style={styles.qtyInput}
                      value={item.quantity}
                      keyboardType="numeric"
                      onChangeText={(text) => updateItem(item.id, 'quantity', text)}
                    />
                    <View style={styles.pillContainer}>
                      {UNITS.map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.miniPill, item.unit === u && styles.miniPillActive]}
                          onPress={() => updateItem(item.id, 'unit', u)}
                        >
                          <Text style={[styles.miniPillText, item.unit === u && styles.miniPillTextActive]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                </View>

                 {/* 3. CATEGORY */}
                 <Text style={styles.label}>Category:</Text>
                 <View style={styles.pillContainer}>
                    {CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.miniPill, item.category === cat && styles.miniPillActive]}
                        onPress={() => updateItem(item.id, 'category', cat)}
                      >
                        <Text style={[styles.miniPillText, item.category === cat && styles.miniPillTextActive]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                 </View>

                 {/* 4. EXPIRATION DATE - WEB & MOBILE COMPATIBLE */}
                 <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>
                      <AntDesign name="calendar" size={14} color="#4A90E2" /> Expires:
                    </Text>

                    {Platform.OS === 'web' ? (
                      // WEB: Native HTML5 Date Input
                      <View style={styles.dateBadge}>
                        <AntDesign name="calendar" size={16} color="#4A90E2" style={{marginRight: 6}}/>
                        <input
                          type="date"
                          value={item.expirationDate ? item.expirationDate.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateItem(item.id, 'expirationDate', new Date(e.target.value));
                            }
                          }}
                          style={{
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            color: '#4A90E2',
                            fontWeight: '600',
                            fontSize: 14,
                            cursor: 'pointer',
                            fontFamily: 'system-ui',
                          }}
                        />
                      </View>
                    ) : (
                      // MOBILE: Touchable Button with Native Picker
                      <TouchableOpacity
                        style={styles.dateBadge}
                        onPress={() => triggerDateEdit(item.id)}
                        activeOpacity={0.7}
                      >
                        <AntDesign name="calendar" size={16} color="#4A90E2" style={{marginRight: 6}}/>
                        <Text style={styles.dateText}>
                          {formatDate(item.expirationDate)}
                        </Text>
                        <MaterialIcons name="edit" size={16} color="#4A90E2" style={{marginLeft: 6}} />
                      </TouchableOpacity>
                    )}
                 </View>
              </View>
            )}
          />
          <View style={styles.modalFooter}>
             <TouchableOpacity style={styles.saveAllBtn} onPress={saveAllItems}>
               {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveAllText}>Save {scannedItems.length} Items</Text>}
             </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Global Picker for Mobile Only */}
        {showGlobalDatePicker && Platform.OS !== 'web' && activeDateId && (
          <DateTimePicker
            value={
              scannedItems.find(item => item.id === activeDateId)?.expirationDate || new Date()
            }
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  menuContainer: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#888', marginBottom: 40 },
  menuStatus: { fontSize: 16, color: '#4A90E2', marginBottom: 20, fontWeight: 'bold' },

  optionsGrid: { flexDirection: 'row', gap: 20 },
  optionCard: {
    backgroundColor: '#fff', padding: 20, borderRadius: 20, alignItems: 'center', width: 150,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  optionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
  closeCameraBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8, marginTop: 40 },
  cameraBottomBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 30 },
  shutterBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#fff' },
  previewImage: { flex: 1, width: '100%', height: '100%' },

  statusOverlay: { position: 'absolute', top: 50, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  statusText: { backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: 10, borderRadius: 20, overflow: 'hidden', fontWeight: 'bold' },

  previewControls: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 20 },
  analyzeBtn: { backgroundColor: '#4A90E2', flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, elevation: 5 },
  cancelBtn: { backgroundColor: '#FF3B30', flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 30, elevation: 5 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  loadingText: { marginTop: 15, fontSize: 18, fontWeight: '600', color: '#fff' },

  modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee', marginTop: Platform.OS === 'ios' ? 40 : 0 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },

  editCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3
  },

  editCardHeader: { marginBottom: 15, borderBottomWidth:1, borderColor:'#f0f0f0', paddingBottom:10 },
  nameDisplayBar: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  nameEditBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F9FF', borderRadius: 8, padding: 5, borderWidth: 1, borderColor: '#4A90E2' },
  nameInputActive: { flex: 1, fontSize: 18, paddingHorizontal: 10, color: '#333' },
  checkBtn: { paddingHorizontal: 10 },

  label: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 5, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },

  qtyInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    width: 60,
    textAlign: 'center',
    marginRight: 10,
    fontSize: 16
  },

  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', flex: 1 },
  miniPill: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 6,
    marginBottom: 6,
  },
  miniPillActive: { backgroundColor: '#4A90E2' },
  miniPillText: { fontSize: 12, color: '#555' },
  miniPillTextActive: { color: '#fff', fontWeight: 'bold' },

  // --- DATE SECTION STYLES ---
  dateRow: {
    flexDirection: 'row',
    marginTop: 15,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  dateLabel: {
    fontSize: 14,
    color: '#4A90E2',
    fontWeight: '600',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A90E2',
    minWidth: 180,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dateText: {
    color: '#4A90E2',
    fontWeight: '600',
    fontSize: 14
  },

  modalFooter: { padding: 20, borderTopWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  saveAllBtn: { backgroundColor: '#4A90E2', padding: 15, borderRadius: 12, alignItems: 'center' },
  saveAllText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});