document.addEventListener("DOMContentLoaded", () => {
    // ===== ELEMENTOS DO DOM ===== //
    const cameraInput = document.getElementById("camera-input");
    const photoPreview = document.getElementById("photo-preview");
    const equipamentoInput = document.getElementById("equipamento");
    const configsInput = document.getElementById("configs");
    const observacoesInput = document.getElementById("observacoes");
    const salvarBtn = document.getElementById("salvar-anotacao");
    const listaFotos = document.getElementById("lista-fotos");
    const filtroData = document.getElementById("filtro-data");
    const filtroCategoria = document.getElementById("filtro-categoria");
    const exportarBtn = document.getElementById("exportar-json");

    // ===== BANCO DE DADOS (IndexedDB) ===== //
    let db;
    const request = indexedDB.open("FotosDiario", 1);

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        db.createObjectStore("fotos", { keyPath: "id", autoIncrement: true });
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        carregarFotos();
    };

    // ===== Função para ler metadados EXIF ===== //
    function lerEXIF(file) {
        return new Promise((resolve) => {
            try {
                EXIF.getData(file, function() {
                    resolve({
                        Model: EXIF.getTag(this, "Model"),
                        FNumber: EXIF.getTag(this, "FNumber"),
                        ISO: EXIF.getTag(this, "ISOSpeedRatings")
                    });
                });
            } catch (e) {
                console.warn("Erro ao ler EXIF:", e);
                resolve({});
            }
        });
    }

    // ===== GEOLOCALIZAÇÃO ===== //
    function obterLocalizacao() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject("Geolocalização não suportada");
            } else {
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    }),
                    (err) => reject(err)
                );
            }
        });
    }

    // ===== CAPTURA DE FOTO ===== //
    cameraInput.addEventListener("change", async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Mostrar preview da imagem
        const reader = new FileReader();
        reader.onload = (event) => {
            photoPreview.src = event.target.result;
            photoPreview.classList.add("ativo");
        };
        reader.readAsDataURL(file);

        // Ler metadados EXIF e preencher campos
        const metadata = await lerEXIF(file);
        if (metadata.Model) {
            equipamentoInput.value = metadata.Model;
        }
        if (metadata.FNumber) {
            configsInput.value = `f/${metadata.FNumber}, ISO ${metadata.ISO || "N/A"}`;
        }
    });

    // ===== SALVAR FOTO + ANOTAÇÕES ===== //
    salvarBtn.addEventListener("click", async () => {
        if (!photoPreview.src) {
            alert("Selecione uma foto primeiro!");
            return;
        }

        try {
            const localizacao = await obterLocalizacao().catch(() => null);

            const fotoData = {
                imagem: photoPreview.src,
                equipamento: equipamentoInput.value,
                configs: configsInput.value,
                observacoes: observacoesInput.value,
                localizacao,
                data: new Date().toISOString(),
                categoria: document.getElementById("categoria").value
            };

            console.log("Salvando dados:", fotoData); // Log para depuração

            const transaction = db.transaction("fotos", "readwrite");
            const store = transaction.objectStore("fotos");
            store.add(fotoData);

            transaction.oncomplete = () => {
                alert("Foto salva com sucesso!");
                limparFormulario();
                filtroData.value = "";
                filtroCategoria.value = "";
                carregarFotos();
            };
        } catch (error) {
            console.error("Erro ao salvar:", error);
        }
    });

    // ===== CARREGAR FOTOS SALVAS ===== //
    function carregarFotos(filtros = {}) {
        const transaction = db.transaction("fotos", "readonly");
        const store = transaction.objectStore("fotos");
        const request = store.getAll();

        request.onsuccess = (event) => {
            const fotos = event.target.result;

            // Aplica filtros
            let fotosFiltradas = fotos;
            if (filtros.data) {
                fotosFiltradas = fotosFiltradas.filter(foto =>
                    new Date(foto.data).toDateString() === new Date(filtros.data).toDateString()
                );
            }
            if (filtros.categoria) {
                fotosFiltradas = fotosFiltradas.filter(foto =>
                    foto.categoria === filtros.categoria
                );
            }

            // Renderiza na tela
            listaFotos.innerHTML = fotosFiltradas.map(foto => `
                <div class="foto-card" data-id="${foto.id}">
                    <img src="${foto.imagem}" alt="Foto">
                    <div class="metadados">
                        <p><strong>${foto.equipamento || "Sem equipamento"}</strong></p>
                        <p>${foto.configs || ""}</p>
                        <p>${new Date(foto.data).toLocaleString()}</p>
                        <button class="btn-remover">Remover</button>
                    </div>
                </div>
            `).join("");

            // Adiciona eventos de remoção
            document.querySelectorAll(".btn-remover").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const id = Number(e.target.closest(".foto-card").dataset.id);
                    removerFoto(id);
                });
            });
        };
    }

    // ===== FUNÇÕES AUXILIARES ===== //
    function limparFormulario() {
        photoPreview.classList.remove("ativo");
        photoPreview.src = "";
        equipamentoInput.value = "";
        configsInput.value = "";
        observacoesInput.value = "";
        cameraInput.value = "";
    }

    function removerFoto(id) {
        const transaction = db.transaction("fotos", "readwrite");
        const store = transaction.objectStore("fotos");
        store.delete(id);
        transaction.oncomplete = () => carregarFotos();
    }

    // ===== FILTROS ===== //
    filtroData.addEventListener("change", () => {
        carregarFotos({ data: filtroData.value });
    });

    filtroCategoria.addEventListener("change", () => {
        carregarFotos({ categoria: filtroCategoria.value });
    });

    // ===== EXPORTAR JSON ===== //
    exportarBtn.addEventListener("click", () => {
        const transaction = db.transaction("fotos", "readonly");
        const store = transaction.objectStore("fotos");
        store.getAll().onsuccess = (event) => {
            const fotos = event.target.result;
            const blob = new Blob([JSON.stringify(fotos)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `fotos-diario_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
        };
    });

    // ===== IMPORTAR JSON ===== //
    document.getElementById("importar-arquivo").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const fotos = JSON.parse(event.target.result);
                const transaction = db.transaction("fotos", "readwrite");
                const store = transaction.objectStore("fotos");

                fotos.forEach(foto => {
                    store.add(foto);
                });

                transaction.oncomplete = () => {
                    alert(`${fotos.length} fotos importadas!`);
                    carregarFotos();
                };
            } catch (error) {
                alert("Arquivo inválido!");
            }
        };
        reader.readAsText(file);
    });
});
