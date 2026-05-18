# 🔌 CONNECTING FRONTEND TO BACKEND

## **Replace localStorage with API Calls**

Your backend is now live at: `https://your-app.railway.app`

Here's how to update your frontend to use it:

---

## **Step 1: Add API Configuration**

At the **TOP** of your main JavaScript (inside `<script>` tag), add:

```javascript
// API Configuration
const API_URL = 'https://YOUR-RAILWAY-URL.up.railway.app/api';

// Helper function to make authenticated API calls
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}
```

---

## **Step 2: Update Login Function**

**REPLACE** your login code with:

```javascript
async function handleLogin(username, pin) {
  try {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, pin })
    });

    // Save token and user info
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('current_user', JSON.stringify(data.user));

    // Redirect to dashboard
    setCurrentPage('dashboard');
    
  } catch (error) {
    alert(error.message);
  }
}
```

---

## **Step 3: Update Data Fetching**

**REPLACE** localStorage data fetching with API calls:

### **Get All Animals:**
```javascript
// OLD WAY (delete this):
// const animals = JSON.parse(localStorage.getItem('animals')) || [];

// NEW WAY:
async function getAnimals() {
  try {
    const animals = await apiCall('/animals');
    return animals;
  } catch (error) {
    console.error('Failed to fetch animals:', error);
    return [];
  }
}
```

### **Add New Animal:**
```javascript
// OLD WAY (delete this):
// const animals = JSON.parse(localStorage.getItem('animals')) || [];
// animals.push(newAnimal);
// localStorage.setItem('animals', JSON.stringify(animals));

// NEW WAY:
async function addAnimal(animalData) {
  try {
    const newAnimal = await apiCall('/animals', {
      method: 'POST',
      body: JSON.stringify(animalData)
    });
    return newAnimal;
  } catch (error) {
    alert('Failed to add animal: ' + error.message);
  }
}
```

### **Update Animal:**
```javascript
async function updateAnimal(id, updates) {
  try {
    const updated = await apiCall(`/animals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return updated;
  } catch (error) {
    alert('Failed to update animal: ' + error.message);
  }
}
```

### **Delete Animal:**
```javascript
async function deleteAnimal(id) {
  try {
    await apiCall(`/animals/${id}`, {
      method: 'DELETE'
    });
  } catch (error) {
    alert('Failed to delete animal: ' + error.message);
  }
}
```

---

## **Step 4: Update React Components (if using React)**

If your frontend uses React, update the component like this:

```javascript
function Dashboard() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnimals();
  }, []);

  async function loadAnimals() {
    setLoading(true);
    try {
      const data = await apiCall('/animals');
      setAnimals(data);
    } catch (error) {
      console.error('Failed to load animals:', error);
    } finally {
      setLoading(false);
    }
  }

  // Rest of component...
}
```

---

## **Step 5: Update All Other Data**

Apply the same pattern to:

- **Feed Ingredients**: `/feed/ingredients`
- **Feed Formulas**: `/feed/formulas`
- **Feeding Logs**: `/feed/logs`
- **Medications**: `/medications`
- **Medication Logs**: `/medications/logs`
- **Breeding Records**: `/breeding`
- **Financial Transactions**: `/finance`
- **Users** (admin only): `/users`

---

## **Step 6: Update CORS in Backend**

Once your frontend is deployed to Netlify:

1. Go to Railway
2. Click your backend service
3. Go to **Variables**
4. Update `FRONTEND_URL` to your Netlify URL:
   ```
   FRONTEND_URL=https://your-site.netlify.app
   ```
5. Save and redeploy

---

## **COMPLETE EXAMPLE: Animals Page**

Here's a full example of an Animals page using the API:

```javascript
function AnimalsPage() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Load animals on mount
  useEffect(() => {
    loadAnimals();
  }, []);

  async function loadAnimals() {
    setLoading(true);
    try {
      const data = await apiCall('/animals');
      setAnimals(data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to load animals');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAnimal(formData) {
    try {
      const newAnimal = await apiCall('/animals', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      // Add to local state
      setAnimals(prev => [newAnimal, ...prev]);
      setShowAddModal(false);
      alert('Animal added successfully!');
    } catch (error) {
      alert('Failed to add animal: ' + error.message);
    }
  }

  async function handleDeleteAnimal(id) {
    if (!confirm('Are you sure?')) return;
    
    try {
      await apiCall(`/animals/${id}`, { method: 'DELETE' });
      
      // Remove from local state
      setAnimals(prev => prev.filter(a => a.id !== id));
      alert('Animal deleted');
    } catch (error) {
      alert('Failed to delete: ' + error.message);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={() => setShowAddModal(true)}>Add Animal</button>
      
      {animals.map(animal => (
        <div key={animal.id}>
          <h3>{animal.name} ({animal.tag})</h3>
          <p>Species: {animal.species}</p>
          <p>Weight: {animal.weight}kg</p>
          <button onClick={() => handleDeleteAnimal(animal.id)}>Delete</button>
        </div>
      ))}
      
      {showAddModal && (
        <AddAnimalModal 
          onAdd={handleAddAnimal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
```

---

## **🐛 DEBUGGING**

If something doesn't work:

### **Check Browser Console:**
1. Right-click page → "Inspect"
2. Click "Console" tab
3. Look for red errors

### **Common Errors:**

**"CORS error"**
- Update `FRONTEND_URL` in Railway to match your Netlify URL

**"401 Unauthorized"**
- Token expired or missing
- Try logging in again

**"Network error"**
- Check your Railway backend is running
- Verify the API_URL is correct

---

## **✅ CHECKLIST**

Before deploying:

- [ ] API_URL points to your Railway backend
- [ ] All localStorage.setItem() for data removed (except auth token)
- [ ] All localStorage.getItem() for data replaced with API calls
- [ ] Login saves token to localStorage
- [ ] All API calls include Authorization header
- [ ] Tested login, add animal, view animals locally
- [ ] No console errors

---

**Next: Deploy frontend to Netlify!**
