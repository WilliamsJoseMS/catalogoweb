// --- INICIALIZACIÓN Y CONFIGURACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Configuración de Firebase (la misma que en admin.js)
    const firebaseConfig = {
      apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
      authDomain: "catalogo-ia-e4060.firebaseapp.com",
      projectId: "catalogo-ia-e4060",
      storageBucket: "catalogo-ia-e4060.appspot.com",
      messagingSenderId: "638377848217",
      appId: "1:638377848217:web:57ac10f018a255b94f3708"
    };

    // Inicializar Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const functions = firebase.functions();

    // --- VARIABLES Y ESTADO ---
    let products = [];
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let currentUser = null;

    // --- REFERENCIAS AL DOM ---
    const productGrid = document.getElementById('product-grid');
    const cartButton = document.getElementById('cart-button');
    const cartCount = document.getElementById('cart-count');
    const cartModal = document.getElementById('cart-modal');
    const userModal = document.getElementById('user-modal');
    const userButton = document.getElementById('user-button');
    const chatToggle = document.getElementById('chat-toggle');
    const chatWidget = document.getElementById('chat-widget');

    // --- CARGA DE DATOS INICIAL ---
    async function loadStore() {
        // Cargar configuración de la tienda
        const settingsDoc = await db.collection('settings').doc('businessInfo').get();
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            document.title = settings.catalogName || 'Catálogo';
            document.getElementById('store-logo').src = settings.logoUrl || '';
            document.getElementById('store-logo').alt = settings.companyName || 'Logo';
            document.getElementById('catalog-name').textContent = settings.catalogName || 'Nuestro Catálogo';
            document.getElementById('company-name-footer').textContent = `© 2024 ${settings.companyName || ''}`;
            document.getElementById('company-address').textContent = settings.address || '';
            document.getElementById('company-phone').textContent = settings.contactPhone || '';
            document.getElementById('company-email').textContent = settings.contactEmail || '';
            document.getElementById('company-taxId').textContent = settings.taxId || '';
        }

        // Cargar productos
        const productsSnapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
        products = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    }
    
    // --- RENDERIZADO ---
    function renderProducts() {
        productGrid.innerHTML = '';
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${product.imageUrl || 'https://via.placeholder.com/300'}" alt="${product.name}" class="product-image">
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <p>${product.desc || 'Sin descripción.'}</p>
                    <div class="product-price">$${product.price.toFixed(2)}</div>
                    <button class="add-to-cart-btn" data-id="${product.id}">Añadir al Carrito</button>
                </div>
            `;
            productGrid.appendChild(card);
        });
    }

    function renderCart() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotalPrice = document.getElementById('cart-total-price');
        
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Tu carrito está vacío.</p>';
        } else {
            cartItemsContainer.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <img src="${item.imageUrl}" alt="${item.name}">
                        <div>
                            <strong>${item.name}</strong><br>
                            <span>${item.quantity} x $${item.price.toFixed(2)}</span>
                        </div>
                    </div>
                    <button class="remove-from-cart-btn" data-id="${item.id}">×</button>
                </div>
            `).join('');
        }
        
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cartTotalPrice.textContent = `$${total.toFixed(2)}`;
        
        updateCartCount();
        localStorage.setItem('cart', JSON.stringify(cart));
    }
    
    function updateCartCount() {
        const count = cart.reduce((sum, item) => sum + item.quantity, 0);
        if (count > 0) {
            cartCount.textContent = count;
            cartCount.classList.remove('hidden');
        } else {
            cartCount.classList.add('hidden');
        }
    }

    // --- LÓGICA DE FUNCIONALIDADES ---
    function addToCart(productId) {
        const product = products.find(p => p.id === productId);
        const cartItem = cart.find(item => item.id === productId);

        if (cartItem) {
            cartItem.quantity++;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        renderCart();
    }
    
    function removeFromCart(productId) {
        cart = cart.filter(item => item.id !== productId);
        renderCart();
    }

    async function placeOrder() {
        if (!currentUser) {
            alert('Por favor, inicia sesión para finalizar tu pedido.');
            openModal(userModal);
            return;
        }
        if (cart.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }

        const order = {
            customer: {
                id: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName || currentUser.email.split('@')[0]
            },
            items: cart,
            total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
            status: 'Recibido',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            const docRef = await db.collection('orders').add(order);
            alert(`¡Pedido #${docRef.id.substring(0,6)} realizado con éxito! Te hemos enviado un PDF de confirmación.`);
            cart = [];
            renderCart();
            closeModal(cartModal);
        } catch (error) {
            console.error("Error al realizar el pedido: ", error);
            alert('Hubo un problema al procesar tu pedido. Por favor, inténtalo de nuevo.');
        }
    }

    // --- MANEJO DE MODALES ---
    function openModal(modal) { modal.classList.remove('hidden'); }
    function closeModal(modal) { modal.classList.add('hidden'); }

    // --- LÓGICA DE AUTENTICACIÓN ---
    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateUserUI();
    });

    function updateUserUI() {
        const authContainer = document.getElementById('auth-container');
        if (currentUser) {
            authContainer.innerHTML = `
                <h2>Bienvenido, ${currentUser.displayName || currentUser.email}</h2>
                <p>Aquí puedes ver tu historial de pedidos.</p>
                <div id="order-history"></div>
                <button id="logout-btn-user">Cerrar Sesión</button>
            `;
            loadOrderHistory();
            document.getElementById('logout-btn-user').addEventListener('click', () => auth.signOut());
        } else {
            authContainer.innerHTML = `
                <div id="login-view">
                    <h2>Iniciar Sesión</h2>
                    <form id="login-form-user">
                        <input type="email" id="login-email" placeholder="Correo" required>
                        <input type="password" id="login-password" placeholder="Contraseña" required>
                        <button type="submit">Ingresar</button>
                    </form>
                    <p>¿No tienes cuenta? <a href="#" id="show-register">Regístrate</a></p>
                </div>
                <div id="register-view" class="hidden">
                    <h2>Crear Cuenta</h2>
                    <form id="register-form-user">
                        <input type="email" id="register-email" placeholder="Correo" required>
                        <input type="password" id="register-password" placeholder="Contraseña (mín. 6 caracteres)" required>
                        <button type="submit">Registrarse</button>
                    </form>
                    <p>¿Ya tienes cuenta? <a href="#" id="show-login">Inicia Sesión</a></p>
                </div>
            `;
            // Attach event listeners for auth forms
            document.getElementById('show-register').addEventListener('click', () => {
                document.getElementById('login-view').classList.add('hidden');
                document.getElementById('register-view').classList.remove('hidden');
            });
            document.getElementById('show-login').addEventListener('click', () => {
                document.getElementById('register-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            });
            document.getElementById('login-form-user').addEventListener('submit', e => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                auth.signInWithEmailAndPassword(email, password).catch(err => alert(err.message));
            });
            document.getElementById('register-form-user').addEventListener('submit', e => {
                e.preventDefault();
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                auth.createUserWithEmailAndPassword(email, password).catch(err => alert(err.message));
            });
        }
    }

    async function loadOrderHistory() {
        const historyContainer = document.getElementById('order-history');
        if (!currentUser || !historyContainer) return;
        historyContainer.innerHTML = 'Cargando...';
        const snapshot = await db.collection('orders').where('customer.id', '==', currentUser.uid).orderBy('timestamp', 'desc').get();
        if (snapshot.empty) {
            historyContainer.innerHTML = '<p>No has realizado pedidos.</p>';
        } else {
            historyContainer.innerHTML = snapshot.docs.map(doc => {
                const order = doc.data();
                return `
                    <div class="list-item">
                        Pedido #${doc.id.substring(0,6)} - ${order.timestamp.toDate().toLocaleDateString()} - $${order.total.toFixed(2)}
                    </div>
                `;
            }).join('');
        }
    }
    
    // --- LÓGICA DEL CHATBOT ---
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    
    chatForm.addEventListener('submit', async e => {
        e.preventDefault();
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        addChatMessage(userMessage, 'user');
        chatInput.value = '';
        addChatMessage('', 'loading'); // Show loading indicator

        try {
            // ¡Llamada a la Cloud Function!
            const askGemini = functions.httpsCallable('askGemini');
            const result = await askGemini({ question: userMessage });
            
            document.querySelector('.message.loading').remove(); // Remove loading indicator
            addChatMessage(result.data.answer, 'ai');
        } catch (error) {
            console.error("Error llamando a la función de Gemini:", error);
            document.querySelector('.message.loading').remove();
            addChatMessage('Lo siento, no puedo responder en este momento.', 'ai');
        }
    });
    
    function addChatMessage(text, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        if (type === 'loading') {
            messageDiv.innerHTML = `<span></span><span></span><span></span>`;
        } else {
            messageDiv.textContent = text;
        }
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // --- LÓGICA DEL TEMA (MODO OSCURO/CLARO) ---
    const themeToggle = document.getElementById('theme-toggle');
    const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>`;
    const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>`;

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
            themeToggle.innerHTML = sunIcon;
        } else {
            document.body.classList.add('light-mode');
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = moonIcon;
        }
    }

    themeToggle.addEventListener('click', () => {
        const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- EVENT LISTENERS GLOBALES ---
    document.addEventListener('click', (e) => {
        // Añadir al carrito
        if (e.target.matches('.add-to-cart-btn')) {
            addToCart(e.target.dataset.id);
        }
        // Quitar del carrito
        if (e.target.matches('.remove-from-cart-btn')) {
            removeFromCart(e.target.dataset.id);
        }
        // Cerrar modales
        if (e.target.matches('.modal-close-btn')) {
            closeModal(e.target.closest('.modal-overlay'));
        }
        // Finalizar pedido
        if (e.target.matches('#checkout-btn')) {
            placeOrder();
        }
    });
    
    cartButton.addEventListener('click', () => openModal(cartModal));
    userButton.addEventListener('click', () => openModal(userModal));
    chatToggle.addEventListener('click', () => chatWidget.classList.remove('hidden'));
    document.querySelector('.chat-close-btn').addEventListener('click', () => chatWidget.classList.add('hidden'));

    // --- INICIO ---
    loadStore();
    renderCart();
    applyTheme(localStorage.getItem('theme') || 'dark');
});
