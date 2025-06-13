// Tu configuración de Firebase actualizada
const firebaseConfig = {
    apiKey: "AIzaSyDWr3Q5l71IuVNknXRSFRooDmFDUYgNyDI",
    authDomain: "catalogo-ia-e4060.firebaseapp.com",
    projectId: "catalogo-ia-e4060",
    storageBucket: "catalogo-ia-e4060.appspot.com", // Es mejor usar ".appspot.com" con el SDK v8 que usamos en el HTML
    messagingSenderId: "638377848217",
    appId: "1:638377848217:web:7ee25b033b831fe44f3708"
};

// Inicializar servicios de Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// Referencias a elementos del DOM
const productForm = document.getElementById('product-form');
const productGrid = document.getElementById('product-grid');

// FUNCIÓN PARA CARGAR Y MOSTRAR LOS PRODUCTOS
const loadProducts = async () => {
    try {
        const snapshot = await db.collection('products').orderBy('name').get();
        
        if (snapshot.empty) {
            productGrid.innerHTML = '<p>No hay productos en el catálogo. ¡Añade el primero!</p>';
            return;
        }

        productGrid.innerHTML = ''; // Limpiar la grilla antes de cargar
        
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

// EVENT LISTENER PARA EL FORMULARIO DE AÑADIR PRODUCTO
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
        // 1. Subir la imagen a Firebase Storage
        const filePath = `products/${Date.now()}_${imageFile.name}`;
        const fileSnapshot = await storage.ref(filePath).put(imageFile);
        
        // 2. Obtener la URL de la imagen subida
        const imageUrl = await fileSnapshot.ref.getDownloadURL();

        // 3. Guardar los datos del producto (incluida la URL) en Firestore
        await db.collection('products').add({
            name: name,
            desc: desc,
            price: price,
            imageUrl: imageUrl
        });

        alert('¡Producto agregado con éxito!');
        productForm.reset(); // Limpiar el formulario
        loadProducts(); // Recargar la lista de productos

    } catch (error) {
        console.error("Error al agregar producto: ", error);
        alert('Hubo un error al agregar el producto.');
    }
});

// Cargar los productos cuando la página se abre por primera vez
loadProducts();
