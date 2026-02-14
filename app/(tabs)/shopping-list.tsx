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
import { db } from '../../firebaseConfig';
import { useAuth } from '../context/AuthContext';

// --- Types ---
interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
  created_at?: Timestamp;
}

// --- Constants ---
const UNITS = ['units', 'kg', 'g', 'L'];

export default function ShoppingList() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState('units');

  // --- Firestore Logic ---
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = collection(db, `users/${user.uid}/shopping_list`);
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedItems: ShoppingItem[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ShoppingItem[];

          // Sort: unchecked items first, then by creation date
          const sorted = fetchedItems.sort((a, b) => {
            if (a.checked !== b.checked) {
              return a.checked ? 1 : -1;
            }
            return (b.created_at?.toMillis() || 0) - (a.created_at?.toMillis() || 0);
          });

          setItems(sorted);
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching shopping list:', error);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up shopping list listener:', error);
      setLoading(false);
    }
  }, [user]);

  // --- Handlers ---
  const handleSaveItem = async () => {
    console.log('Save button clicked!');

    if (!formName.trim()) {
      Alert.alert('Validation', 'Please enter an item name');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    const payload = {
      name: formName,
      quantity: parseFloat(formQuantity) || 1,
      unit: formUnit,
      checked: false,
    };

    console.log('Saving payload:', payload);

    try {
      if (isEditing && editingId) {
        console.log('Updating item:', editingId);
        await updateDoc(doc(db, `users/${user.uid}/shopping_list`, editingId), payload);
      } else {
        console.log('Adding new item to shopping list');
        const docRef = await addDoc(collection(db, `users/${user.uid}/shopping_list`), {
          ...payload,
          created_at: Timestamp.now(),
        });
        console.log('Item added with ID:', docRef.id);
      }
      Alert.alert('Success', 'Item saved!');
      closeModal();
    } catch (error: any) {
      console.error('Error saving:', error);
      Alert.alert('Error', `Could not save item: ${error.message}`);
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormName('');
    setFormQuantity('1');
    setFormUnit('units');
    setModalVisible(true);
  };

  const openEditModal = (item: ShoppingItem) => {
    setIsEditing(true);
    setEditingId(item.id);
    setFormName(item.name);
    setFormQuantity(item.quantity.toString());
    setFormUnit(item.unit || 'units');
    setModalVisible(true);
  };

  const deleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/shopping_list`, id));
    } catch (error) {
      console.error('Delete error', error);
    }
  };

  const toggleCheckItem = async (item: ShoppingItem) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/shopping_list`, item.id), {
        checked: !item.checked,
      });
    } catch (error) {
      console.error('Toggle error', error);
    }
  };

  const clearCheckedItems = async () => {
    if (!user) return;
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) {
      Alert.alert('Info', 'No checked items to clear');
      return;
    }

    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedItems.length} checked item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletePromises = checkedItems.map(item =>
                deleteDoc(doc(db, `users/${user.uid}/shopping_list`, item.id))
              );
              await Promise.all(deletePromises);
            } catch (error) {
              console.error('Clear error', error);
              Alert.alert('Error', 'Could not clear items');
            }
          },
        },
      ]
    );
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const addCheckedItemsToInventory = async () => {
    if (!user) return;
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length === 0) {
      Alert.alert('Info', 'No checked items to add to inventory');
      return;
    }

    Alert.alert(
      'Add to Inventory',
      `Add ${checkedItems.length} checked item(s) to your house inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: async () => {
            try {
              const inventoryRef = collection(db, `users/${user.uid}/inventory`);
              const addPromises = checkedItems.map(item =>
                addDoc(inventoryRef, {
                  name: item.name,
                  category: 'Pantry', // Default category
                  quantity: item.quantity,
                  unit: item.unit,
                  expiration_date: null,
                  created_at: Timestamp.now(),
                })
              );
              await Promise.all(addPromises);

              // Remove from shopping list
              const deletePromises = checkedItems.map(item =>
                deleteDoc(doc(db, `users/${user.uid}/shopping_list`, item.id))
              );
              await Promise.all(deletePromises);

              Alert.alert('Success', 'Items added to inventory!');
            } catch (error) {
              console.error('Error adding to inventory:', error);
              Alert.alert('Error', 'Could not add items to inventory');
            }
          },
        },
      ]
    );
  };

  // --- Render Components ---
  const renderItem = ({ item }: { item: ShoppingItem }) => {
    return (
      <View style={[styles.card, item.checked && styles.cardChecked]}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleCheckItem(item)}
        >
          <MaterialIcons
            name={item.checked ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={item.checked ? '#4A90E2' : '#999'}
          />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
            {item.name}
          </Text>
          <Text style={styles.itemMeta}>
            {item.quantity} {item.unit}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
            <MaterialIcons name="edit" size={22} color="#4A90E2" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.iconBtn}>
            <MaterialIcons name="delete" size={22} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  const checkedCount = items.filter(item => item.checked).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {checkedCount > 0 && (
            <>
              <TouchableOpacity onPress={addCheckedItemsToInventory} style={styles.addButton}>
                <MaterialIcons name="add-shopping-cart" size={22} color="#4A90E2" />
                <Text style={styles.addText}>Add to House</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearCheckedItems} style={styles.clearButton}>
                <MaterialIcons name="delete-sweep" size={22} color="#FF6B6B" />
                <Text style={styles.clearText}>Remove</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="shopping-cart" size={64} color="#ddd" />
            <Text style={styles.emptyText}>Your shopping list is empty!</Text>
            <Text style={styles.emptySubtext}>Add items you need to buy</Text>
          </View>
        }
      />

      {!modalVisible && (
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <AntDesign name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add/Edit Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Item' : 'Add Item'}
              </Text>

              <Text style={styles.label}>Item Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Milk, Bread, Eggs"
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.label}>Quantity & Unit</Text>
              <View style={styles.quantityRow}>
                <TextInput
                  style={[styles.input, { flex: 0.4, marginBottom: 0 }]}
                  placeholder="1"
                  keyboardType="numeric"
                  value={formQuantity}
                  onChangeText={setFormQuantity}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.unitSelector}
                  contentContainerStyle={styles.unitSelectorContent}
                >
                  {UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitPill, formUnit === u && styles.unitPillActive]}
                      onPress={() => setFormUnit(u)}
                    >
                      <Text style={[styles.unitText, formUnit === u && styles.unitTextActive]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addText: {
    marginLeft: 5,
    color: '#4A90E2',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearText: {
    marginLeft: 5,
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 15,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardChecked: {
    backgroundColor: '#f9f9f9',
    opacity: 0.7,
  },
  checkbox: {
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemMeta: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
  },
  iconBtn: {
    marginLeft: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#999',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    marginTop: 8,
    color: '#bbb',
    fontSize: 14,
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
    zIndex: 999,
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
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitSelector: {
    flex: 0.55,
  },
  unitSelectorContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 10,
  },
  unitPill: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
    marginRight: 5,
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
});
