// Tu configuración de Firebase actualizada
const firebaseConfig = {
    apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
    authDomain: "catalogo-ia-e4060.firebaseapp.com",
    projectId: "catalogo-ia-e4060",
    storageBucket: "catalogo-ia-e4060.appspot.com",
    messagingSenderId: "638377848217",
    appId: "1:638377848217:web:7ee25b033b831fe44f3708"
};

document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos del DOM
    const productForm = document.getElementById('product-form');
    const productGrid = document.getElementById('product-grid');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const submitButton = document.getElementById('submit-button');

    let db;
    let storage;

    // --- FUNCIÓN PARA VERIFICAR LA CONEXIÓN Y ESTADO ---
    const setStatus = (connected, message) => {
        if (connected) {
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'En Línea';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Sin Conexión';
            if (message) {
                productGrid.innerHTML = `<p>${message}</p>`;
            }
        }
    };

    // --- FUNCIÓN PARA CARGAR PRODUCTOS ---
    const loadProducts = async () => {
        if (!db) {
            console.error("Firestore no está inicializado.");
            return;
        }
        productGrid.innerHTML = '<p>Cargando productos...</p>';
        try {
            const snapshot = await db.collection('products').orderBy('name').get();
            productGrid.innerHTML = ''; // Limpiar la grilla
            
            if (snapshot.empty) {
                productGrid.innerHTML = '<p>No hay productos en el catálogo. ¡Añade el primero!</p>';
            } else {
                snapshot.forEach((doc, index) => {
                    const product = doc.data();
                    const card = document.createElement('div');
                    card.className = 'product-card';
                    // Añadimos un retraso a la animación para un efecto escalonado
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
            setStatus(false, 'Error al leer la base de datos. Verifica las reglas de Firestore.');
        }
    };

    // --- INICIALIZACIÓN DE FIREBASE ---
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage();
        
        // Verificación inicial de conexión
        db.collection('__check').doc('__check').get()
            .then(() => {
                setStatus(true);
                loadProducts(); // Si la conexión es exitosa, cargamos los productos.
            })
            .catch(error => {
                console.error("Fallo la verificación inicial:", error);
                setStatus(false, 'No se pudo conectar a la base de datos.');
            });

    } catch (error) {
        console.error("Error CRÍTICO al inicializar Firebase:", error);
        setStatus(false, 'La configuración de Firebase es incorrecta.');
    }

    // --- EVENT LISTENER PARA EL FORMULARIO ---
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!db) {
            alert('No se puede agregar el producto. No hay conexión con la base de datos.');
            return;
        }

        const name = document.getElementById('product-name').value;
        const desc = document.getElementById('product-desc').value;
        const price = parseFloat(document.getElementById('product-price').value);
        const imageFile = document.getElementById('product-image').files[0];

        if (!imageFile) {
            alert('Por favor, selecciona una imagen para el producto.');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Subiendo...';

        try {
            const filePath = `products/${Date.now()}_${imageFile.name}`;
            const fileSnapshot = await storage.ref(filePath).put(imageFile);
            const imageUrl = await fileSnapshot.ref.getDownloadURL();
            await db.collection('products').add({ name, desc, price, imageUrl, createdAt: firebase.firestore.FieldValue.serverTimestamp() });

            alert('¡Producto agregado con éxito!');
            productForm.reset();
            loadProducts();

        } catch (error) {
            console.error("Error al agregar producto: ", error);
            alert('Hubo un error al agregar el producto.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Agregar Producto';
        }
    });
});
