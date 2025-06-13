// Tu configuración de Firebase actualizada
const firebaseConfig = {
    apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
    authDomain: "catalogo-ia-e4060.firebaseapp.com",
    projectId: "catalogo-ia-e4060",
    storageBucket: "catalogo-ia-e4060.appspot.com",
    messagingSenderId: "638377848217",
    appId: "1:638377848217:web:7ee25b033b831fe44f3708"
};

// --- INICIALIZACIÓN Y REFERENCIAS ---
try {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Referencias a elementos del DOM
    const productForm = document.getElementById('product-form');
    const productGrid = document.getElementById('product-grid');
    const statusIndicator = document.getElementById('status-indicator');

    // --- LÓGICA DEL INDICADOR DE ESTADO ---
    const checkConnection = async () => {
        try {
            // Intenta leer un documento que no existe. Es una operación de bajo costo.
            // Si las reglas y la conexión son correctas, esto no dará error, solo no encontrará nada.
            await db.collection('__check').doc('__check').get();
            
            // Si la línea anterior no lanzó un error, estamos conectados.
            console.log("✅ Conexión con Firebase verificada.");
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            
            // Ahora que sabemos que estamos conectados, cargamos los productos.
            loadProducts();

        } catch (error) {
            // Si hay CUALQUIER error (red, permisos, etc.), lo consideramos desconectado.
            console.error("🔥 Error de conexión con Firebase:", error.message);
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            productGrid.innerHTML = `<p>Error de conexión. No se pueden cargar los productos.</p>`;
        }
    };

    // --- FUNCIÓN PARA CARGAR PRODUCTOS ---
    const loadProducts = async () => {
        try {
            productGrid.innerHTML = '<p>Cargando productos...</p>';
            const snapshot = await db.collection('products').orderBy('name').get();
            
            if (snapshot.empty) {
                productGrid.innerHTML = '<p>No hay productos en el catálogo. ¡Añade el primero!</p>';
                return;
            }
            productGrid.innerHTML = ''; 
            
            snapshot.forEach(doc => {
                const product = doc.data();
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p>${product.desc}</p>
                        <div class="product-price">$${product.price.toFixed(2)}</div>
                    </div>
                `;
                productGrid.appendChild(card);
            });

        } catch (error) {
            console.error("Error al cargar productos: ", error);
            productGrid.innerHTML = '<p>Error al cargar productos. Revisa la consola para más detalles.</p>';
        }
    };

    // --- EVENT LISTENER PARA EL FORMULARIO ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('product-name').value;
        const desc = document.getElementById('product-desc').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const imageFile = document.getElementById('product-image').files[0];

        if (!imageFile) {
            alert('Por favor, selecciona una imagen para el producto.');
            return;
        }

        try {
            const filePath = `products/${Date.now()}_${imageFile.name}`;
            const fileSnapshot = await storage.ref(filePath).put(imageFile);
            const imageUrl = await fileSnapshot.ref.getDownloadURL();

            await db.collection('products').add({ name, desc, price, imageUrl });

            alert('¡Producto agregado con éxito!');
            productForm.reset();
            loadProducts();

        } catch (error) {
            console.error("Error al agregar producto: ", error);
            alert('Hubo un error al agregar el producto. ¿Estás conectado?');
        }
    });

    // --- INICIO DE LA APLICACIÓN ---
    // Al cargar la página, primero verificamos la conexión.
    checkConnection();

} catch (error) {
    // Este error ocurre si firebase.initializeApp falla (ej. config mal escrita)
    console.error("⛔ Error CRÍTICO al inicializar Firebase:", error);
    const statusIndicator = document.getElementById('status-indicator');
    if (statusIndicator) {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
    }
}
