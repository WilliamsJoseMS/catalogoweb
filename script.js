document.addEventListener('DOMContentLoaded', () => {
    // Tu configuración de Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
        authDomain: "catalogo-ia-e4060.firebaseapp.com",
        projectId: "catalogo-ia-e4060",
        storageBucket: "catalogo-ia-e4060.appspot.com",
        messagingSenderId: "638377848217",
        appId: "1:638377848217:web:7ee25b033b831fe44f3708"
    };

    // --- REFERENCIAS Y VARIABLES ---
    const productForm = document.getElementById('product-form');
    const productGrid = document.getElementById('product-grid');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const submitButton = document.getElementById('submit-button');
    let db;
    let functions;

    // --- FUNCIONES DE ESTADO Y CARGA ---
    const setStatus = (connected, message) => {
        statusIndicator.classList.toggle('connected', connected);
        statusIndicator.classList.toggle('disconnected', !connected);
        statusText.textContent = connected ? 'En Línea' : 'Sin Conexión';
        if (!connected && message) productGrid.innerHTML = `<p>${message}</p>`;
    };

    const loadProducts = async () => {
        if (!db) return;
        productGrid.innerHTML = '<p>Cargando productos...</p>';
        try {
            const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
            productGrid.innerHTML = '';
            if (snapshot.empty) {
                productGrid.innerHTML = '<p>No hay productos. ¡Añade el primero!</p>';
            } else {
                snapshot.forEach((doc, index) => {
                    const product = doc.data();
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    card.style.animationDelay = `${index * 0.1}s`;
                    card.innerHTML = `
                        <div class="product-image-container">
                            <img src="${product.imageUrl}" alt="${product.name}" class="product-image">
                        </div>
                        <div class="product-info">
                            <h3>${product.name}</h3>
                            <p>${product.desc || 'Sin descripción.'}</p>
                            <div class="product-price">$${product.price.toFixed(2)}</div>
                        </div>
                    `;
                    productGrid.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Error al cargar productos: ", error);
            setStatus(false, 'Error al leer la base de datos.');
        }
    };

    // --- INICIALIZACIÓN DE FIREBASE ---
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        functions = firebase.functions(); // Inicializamos las funciones
        
        db.collection('__check').doc('__check').get()
            .then(() => {
                setStatus(true);
                loadProducts();
            })
            .catch(error => {
                console.error("Fallo la verificación inicial:", error);
                setStatus(false, 'No se pudo conectar a la base de datos.');
            });
    } catch (error) {
        console.error("Error CRÍTICO al inicializar Firebase:", error);
        setStatus(false, 'La configuración de Firebase es incorrecta.');
    }

    // --- EVENT LISTENER DEL FORMULARIO (LÓGICA ACTUALIZADA) ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!db) {
            alert('Error: Sin conexión con la base de datos.');
            return;
        }

        const name = document.getElementById('product-name').value;
        const desc = document.getElementById('product-desc').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const imageFile = document.getElementById('product-image').files[0];

        if (!imageFile) {
            alert('Por favor, selecciona una imagen.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Subiendo a Drive...';

        try {
            // 1. Prepara los datos para enviar a la Cloud Function
            const formData = new FormData();
            formData.append('image', imageFile);
            
            // Obtiene la URL de la Cloud Function
            const uploadFunctionUrl = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/uploadToDrive`;
            
            // 2. Llama a la Cloud Function para subir la imagen a Google Drive
            const response = await fetch(uploadFunctionUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`El servidor respondió con un error: ${response.statusText}`);
            }

            const result = await response.json();
            const imageUrl = result.imageUrl;

            // 3. Guarda la URL de Drive en Firestore
            await db.collection('products').add({ 
                name, 
                desc, 
                price, 
                imageUrl, // ¡Esta es la URL pública de Google Drive!
                createdAt: firebase.firestore.FieldValue.serverTimestamp() 
            });

            alert('¡Producto agregado con éxito! Imagen en Google Drive.');
            productForm.reset();
            loadProducts();

        } catch (error) {
            console.error("Error al agregar producto: ", error);
            alert(`Hubo un error: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Agregar Producto';
        }
    });
});
