import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView
} from 'react-native';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { AntDesign, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db } from '../../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// --- Types ---
interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiration_date?: Timestamp | null;
  created_at?: Timestamp;
}

// --- Constants ---
const CATEGORIES = ['Pantry', 'FruitVeg', 'Freezer', 'Refrigerator'];
const UNITS = ['units', 'kg', 'g', 'L']; // <--- New Units List
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export default function Index() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Pantry');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState('units'); // <--- New Unit State

  // Date State
  const [formDate, setFormDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- Helpers ---

  const getItemStatus = (date?: Timestamp | null) => {
    if (!date) return 'fresh';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiry = date.toDate();
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / DAY_IN_MS);

    if (diffDays < 0) return 'expired';
    if (diffDays <= 7) return 'expiring_soon';
    return 'fresh';
  };

  const sortItems = (items: InventoryItem[]) => {
    return items.sort((a, b) => {
      const statusOrder = { expired: 0, expiring_soon: 1, fresh: 2 };
      const statusA = getItemStatus(a.expiration_date);
      const statusB = getItemStatus(b.expiration_date);
      return statusOrder[statusA] - statusOrder[statusB];
    });
  };

  // --- Firestore Logic ---

  useEffect(() => {
    if (!user) return;

    const q = collection(db, `users/${user.uid}/inventory`);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems: InventoryItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as InventoryItem[];
      setItems(sortItems(fetchedItems));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Handlers ---

  const handleSaveItem = async () => {
    if (!formName.trim()) {
      Alert.alert('Validation', 'Please enter a name');
      return;
    }
    if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
    }

    const payload = {
      name: formName,
      category: formCategory,
      quantity: parseFloat(formQuantity) || 1, // Changed to parseFloat to allow 0.5 kg
      unit: formUnit, // <--- Saving the selected unit
      expiration_date: formDate ? Timestamp.fromDate(formDate) : null,
    };

    try {
      if (isEditing && editingId) {
        await updateDoc(doc(db, `users/${user.uid}/inventory`, editingId), payload);
      } else {
        await addDoc(collection(db, `users/${user.uid}/inventory`), {
          ...payload,
          created_at: Timestamp.now(),
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Error', 'Could not save item.');
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormName('');
    setFormCategory('Pantry');
    setFormQuantity('1');
    setFormUnit('units'); // Default
    setFormDate(null);
    setModalVisible(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormQuantity(item.quantity.toString());
    setFormUnit(item.unit || 'units'); // Load saved unit
    setFormDate(item.expiration_date ? item.expiration_date.toDate() : null);
    setModalVisible(true);
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/inventory`, id));
    } catch (error) {
      console.error("Delete error", error);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowDatePicker(false);
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFormDate(selectedDate);
    }
  };

  // --- Render Components ---

  const renderItem = ({ item }: { item: InventoryItem }) => {
    const status = getItemStatus(item.expiration_date);
    let cardStyle = styles.card;
    let statusText = '';

    if (status === 'expired') {
        cardStyle = { ...styles.card, ...styles.cardExpired };
        statusText = 'Expired!';
    } else if (status === 'expiring_soon') {
        cardStyle = { ...styles.card, ...styles.cardExpiring };
        statusText = 'Expiring soon';
    }

    return (
      <View style={cardStyle}>
        <View style={styles.cardContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            {/* Display Quantity AND Unit */}
            <Text style={styles.itemMeta}>
              {item.quantity} {item.unit} • {item.category}
            </Text>
            {item.expiration_date && (
                <Text style={[styles.expiryText, status === 'expired' && styles.textRed]}>
                    Expires: {item.expiration_date.toDate().toLocaleDateString()}
                    {statusText ? ` (${statusText})` : ''}
                </Text>
            )}
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
              <MaterialIcons name="edit" size={24} color="#4A90E2" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.iconBtn}>
              <MaterialIcons name="delete" size={24} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const filteredItems = selectedCategory
    ? items.filter((i) => i.category === selectedCategory)
    : items;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* --- Filter Header (Safe Area Wrapper) --- */}
      {/* Added extra padding on top for iOS notch */}
      <View style={styles.headerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.headerScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.filterText, !selectedCategory && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Your pantry is empty!</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <AntDesign name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* --- Add/Edit Modal --- */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Item' : 'Add Item'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pasta"
              value={formName}
              onChangeText={setFormName}
            />

            {/* Quantity Row */}
            <Text style={styles.label}>Quantity & Unit</Text>
            <View style={styles.quantityRow}>
                <TextInput
                style={[styles.input, { flex: 0.4, marginBottom: 0 }]}
                placeholder="1"
                keyboardType="numeric"
                value={formQuantity}
                onChangeText={setFormQuantity}
                />
                <View style={styles.unitSelector}>
                    {UNITS.map((u) => (
                        <TouchableOpacity
                            key={u}
                            style={[styles.unitPill, formUnit === u && styles.unitPillActive]}
                            onPress={() => setFormUnit(u)}
                        >
                            <Text style={[styles.unitText, formUnit === u && styles.unitTextActive]}>{u}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.catPill, formCategory === cat && styles.catPillActive]}
                        onPress={() => setFormCategory(cat)}
                    >
                        <Text style={[styles.catPillText, formCategory === cat && styles.catPillTextActive]}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Expiration Date</Text>
            <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker((prev) => !prev)}
            >
                <Text style={{ color: formDate ? '#000' : '#aaa', fontSize: 16 }}>
                    {formDate ? formDate.toLocaleDateString() : 'Select Date (Optional)'}
                </Text>
                <AntDesign name="calendar" size={20} color="#666" style={{ position: 'absolute', right: 15, top: 12 }}/>
            </TouchableOpacity>

            {showDatePicker && (
                <View style={styles.datePickerContainer}>
                    <DateTimePicker
                        value={formDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        themeVariant="light"
                        textColor="black"
                    />
                    {Platform.OS === 'ios' && (
                        <TouchableOpacity
                            style={styles.iosDatePickerButton}
                            onPress={() => setShowDatePicker(false)}
                        >
                            <Text style={styles.iosDatePickerButtonText}>Done</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={closeModal} style={[styles.btn, styles.btnCancel]}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveItem} style={[styles.btn, styles.btnSave]}>
                <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- Header Fix for Notch ---
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
    // Add top padding specifically for iOS to clear the notch
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  headerScroll: {
    paddingHorizontal: 15,
  },
  // ---------------------------
  listContent: {
    padding: 15,
    paddingBottom: 100,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#4A90E2',
  },
  filterText: {
    color: '#333',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardExpired: {
    backgroundColor: '#ffe6e6',
    borderColor: '#d32f2f',
  },
  cardExpiring: {
    backgroundColor: '#fff',
    borderColor: '#fbc02d',
    borderWidth: 2,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  itemMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  expiryText: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic',
  },
  textRed: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 15,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#444',
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
    justifyContent: 'center',
  },
  // New Styles for Quantity Row
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitSelector: {
    flexDirection: 'row',
    flex: 0.55,
    justifyContent: 'space-between',
  },
  unitPill: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  unitPillActive: {
    backgroundColor: '#4A90E2',
  },
  unitText: {
    color: '#555',
    fontSize: 12,
  },
  unitTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // --------------------------
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  catPill: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  catPillActive: {
    backgroundColor: '#4A90E2',
  },
  catPillText: {
    color: '#555',
  },
  catPillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  btn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  btnSave: {
    backgroundColor: '#4A90E2',
  },
  btnText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  datePickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 15,
    marginTop: 10,
    overflow: 'hidden',
  },
  iosDatePickerButton: {
    backgroundColor: '#eee',
    padding: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  iosDatePickerButtonText: {
    color: '#4A90E2',
    fontWeight: 'bold',
    fontSize: 16,
  }
});