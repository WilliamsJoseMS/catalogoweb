const firebaseConfig = {
  apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
  authDomain: "catalogo-ia-e4060.firebaseapp.com",
  projectId: "catalogo-ia-e4060",
  storageBucket: "catalogo-ia-e4060.appspot.com", // <-- CORRECCIÓN: Usa el que Firebase te da, que podría ser este...
  // O el original que me pasaste:
  // storageBucket: "catalogo-ia-e4060.firebasestorage.app", // <-- Intenta con este si el de arriba no funciona.
  messagingSenderId: "638377848217",
  appId: "1:638377848217:web:57ac10f018a255b94f3708"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();

// --- Elementos del DOM ---
const loginContainer = document.getElementById('login-container');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');

const productForm = document.getElementById('product-form');
const productList = document.getElementById('product-list');

const settingsForm = document.getElementById('settings-form');
const aiForm = document.getElementById('ai-form');

const orderList = document.getElementById('order-list');

// --- Lógica de Autenticación ---
auth.onAuthStateChanged(user => {
    if (user) {
        loginContainer.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        loadProducts();
        loadSettings();
        loadAiKnowledge();
        loadOrders();
    } else {
        loginContainer.classList.remove('hidden');
        adminPanel.classList.add('hidden');
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            loginError.textContent = `Error: ${error.message}`;
            loginError.classList.remove('hidden');
        });
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// --- Lógica de Productos (CRUD) ---
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const name = document.getElementById('product-name').value;
    const desc = document.getElementById('product-desc').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const imageFile = document.getElementById('product-image').files[0];

    try {
        let imageUrl = productForm.dataset.currentImage || '';
        if (imageFile) {
            const filePath = `products/${Date.now()}_${imageFile.name}`;
            const fileSnapshot = await storage.ref(filePath).put(imageFile);
            imageUrl = await fileSnapshot.ref.getDownloadURL();
        }

        const productData = { name, desc, price, imageUrl, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

        if (id) {
            await db.collection('products').doc(id).update(productData);
            alert('Producto actualizado con éxito');
        } else {
            await db.collection('products').add(productData);
            alert('Producto guardado con éxito');
        }

        productForm.reset();
        document.getElementById('product-id').value = '';
        delete productForm.dataset.currentImage;
        loadProducts();
    } catch (error) {
        console.error("Error al guardar producto: ", error);
        alert(`Error: ${error.message}`);
    }
});

async function loadProducts() {
    const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
    productList.innerHTML = '';
    snapshot.forEach(doc => {
        const product = doc.data();
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div class="list-item-info">
                <img src="${product.imageUrl || 'https://via.placeholder.com/60'}" alt="${product.name}">
                <div>
                    <strong>${product.name}</strong><br>
                    <span>$${product.price.toFixed(2)}</span>
                </div>
            </div>
            <div class="list-item-actions">
                <button onclick="editProduct('${doc.id}')">Editar</button>
                <button class="btn-delete" onclick="deleteProduct('${doc.id}')">Borrar</button>
            </div>
        `;
        productList.appendChild(div);
    });
}

window.editProduct = async (id) => {
    const doc = await db.collection('products').doc(id).get();
    if (doc.exists) {
        const product = doc.data();
        document.getElementById('product-id').value = id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-desc').value = product.desc;
        document.getElementById('product-price').value = product.price;
        productForm.dataset.currentImage = product.imageUrl;
        alert('Datos cargados en el formulario para editar.');
        window.scrollTo(0, 0);
    }
};

window.deleteProduct = async (id) => {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
        await db.collection('products').doc(id).delete();
        alert('Producto eliminado.');
        loadProducts();
    }
};

// --- Lógica de Configuración ---
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const logoFile = document.getElementById('logoUpload').files[0];
    const settingsData = {
        companyName: document.getElementById('companyName').value,
        catalogName: document.getElementById('catalogName').value,
        contactPhone: document.getElementById('contactPhone').value,
        contactEmail: document.getElementById('contactEmail').value,
        taxId: document.getElementById('taxId').value,
        address: document.getElementById('address').value,
        whatsappLink: document.getElementById('whatsappLink').value,
    };

    try {
        let logoUrl = document.getElementById('logo-preview').src;
        if (logoFile) {
            const filePath = `settings/logo_${Date.now()}`;
            const fileSnapshot = await storage.ref(filePath).put(logoFile);
            logoUrl = await fileSnapshot.ref.getDownloadURL();
        }
        settingsData.logoUrl = logoUrl;

        await db.collection('settings').doc('businessInfo').set(settingsData, { merge: true });
        alert('Configuración guardada con éxito.');
    } catch (error) {
        console.error("Error guardando configuración: ", error);
        alert(`Error: ${error.message}`);
    }
});

async function loadSettings() {
    const doc = await db.collection('settings').doc('businessInfo').get();
    if (doc.exists) {
        const settings = doc.data();
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) element.value = settings[key];
        });
        if (settings.logoUrl) {
            document.getElementById('logo-preview').src = settings.logoUrl;
        }
    }
}

// --- Lógica de Entrenamiento IA ---
aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const knowledge = document.getElementById('ai-knowledge').value;
    try {
        await db.collection('settings').doc('aiKnowledge').set({ context: knowledge });
        alert('Base de conocimiento de la IA actualizada.');
    } catch (error) {
        console.error("Error guardando conocimiento IA: ", error);
        alert(`Error: ${error.message}`);
    }
});

async function loadAiKnowledge() {
    const doc = await db.collection('settings').doc('aiKnowledge').get();
    if (doc.exists) {
        document.getElementById('ai-knowledge').value = doc.data().context || '';
    }
}

// --- Cargar Pedidos ---
async function loadOrders() {
    db.collection('orders').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        if (snapshot.empty) {
            orderList.innerHTML = '<p>No hay pedidos todavía.</p>';
            return;
        }
        
        orderList.innerHTML = '';
        snapshot.forEach(doc => {
            const order = doc.data();
            const orderDate = order.timestamp.toDate().toLocaleString('es-ES');
            
            const productsHtml = order.items.map(item => 
                `<li>${item.quantity} x ${item.name} ($${(item.price * item.quantity).toFixed(2)})</li>`
            ).join('');

            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <div>
                    <strong>Pedido #${doc.id.substring(0, 6)}...</strong> - <span>${orderDate}</span><br>
                    <span>Cliente: ${order.customer.name} (${order.customer.email})</span><br>
                    <span>Total: <strong>$${order.total.toFixed(2)}</strong></span>
                    <ul>${productsHtml}</ul>
                </div>
            `;
            orderList.appendChild(div);
        });
    }, error => {
        console.error("Error al cargar pedidos:", error);
        orderList.innerHTML = '<p>Error al cargar los pedidos.</p>';
    });
}
