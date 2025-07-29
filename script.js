document.addEventListener("DOMContentLoaded", () => {
    // Elementos DOM
    const cameraInput = document.getElementById("camera-input");
    const btnCapturar = document.getElementById("btn-capturar");
    const photoPreview = document.getElementById("photo-preview");
    const btnSalvar = document.getElementById("btn-salvar");
    const listaFotos = document.getElementById("lista-fotos");
    
    // Banco de dados
    let db;
    const request = indexedDB.open("DiarioFotosDB", 1);

    request.onupgradeneeded = (e) => {
        db = e.target.result;
        db.createObjectStore("fotos", { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = (e) => {
        db = e.target.result;
        carregarGaleria();
    };

    // Eventos
    btnCapturar.addEventListener("click", () => cameraInput.click());
    
    cameraInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            photoPreview.src = event.target.result;
            photoPreview.classList.add("ativo");
        };
        reader.readAsDataURL(file);
    });

    btnSalvar.addEventListener("click", () => {
        if (!photoPreview.src) {
            alert("Capture uma foto primeiro!");
            return;
        }

        const fotoData = {
            imagem: photoPreview.src,
            equipamento: document.getElementById("equipamento").value || "Não informado",
            observacoes: document.getElementById("observacoes").value || "",
            data: new Date().toLocaleString()
        };

        const transaction = db.transaction("fotos", "readwrite");
        const store = transaction.objectStore("fotos");
        store.add(fotoData);

        transaction.oncomplete = () => {
            alert("Foto salva na galeria!");
            photoPreview.classList.remove("ativo");
            photoPreview.src = "";
            document.getElementById("equipamento").value = "";
            document.getElementById("observacoes").value = "";
            carregarGaleria();
        };
    });

    // Carrega fotos salvas
    function carregarGaleria() {
        const transaction = db.transaction("fotos", "readonly");
        const store = transaction.objectStore("fotos");
        const request = store.getAll();

        request.onsuccess = (e) => {
            listaFotos.innerHTML = e.target.result.map(foto => `
                <div class="foto-card">
                    <img src="${foto.imagem}" alt="Foto">
                    <div class="foto-info">
                        <p><strong>${foto.equipamento}</strong></p>
                        <p>${foto.observacoes || "Sem observações"}</p>
                        <small>${foto.data}</small>
                    </div>
                </div>
            `).join("");
        };
    }

    // Ano atual no footer
    document.getElementById("ano-atual").textContent = new Date().getFullYear();
});