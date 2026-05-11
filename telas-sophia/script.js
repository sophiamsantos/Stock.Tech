/*
   =========================================================
   STOCK.TECH - JS GLOBAL (todas as telas)
   Detecta automaticamente qual tela está aberta pelos
   elementos presentes no DOM e ativa o módulo correspondente.
   =========================================================
*/

const STORAGE_KEY = 'stocktech_produtos';
const CORES_PLACEHOLDER = [
    'placeholder-rosa',
    'placeholder-amarelo',
    'placeholder-azul',
    'placeholder-roxo',
    'placeholder-verde',
    'placeholder-laranja'
];

// Tamanho padrão (lado maior, em pixels) para imagens redimensionadas.
// Imagens com lado maior que isso são reduzidas mantendo a proporção.
const IMG_MAX_LADO = 800;
const IMG_QUALIDADE = 0.85;

/* =========================================================
   UTILIDADES COMPARTILHADAS
   ========================================================= */
function carregarProdutos() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function salvarProdutos(produtos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos));
}

function gerarId() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function corPorId(id) {
    const soma = String(id).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return CORES_PLACEHOLDER[soma % CORES_PLACEHOLDER.length];
}

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ---------------------------------------------------------
   Redimensiona um File de imagem para um tamanho padrão,
   preservando a proporção. Retorna uma Promise com a
   string base64 (data URL) pronta para salvar/exibir.
   --------------------------------------------------------- */
function redimensionarImagem(file, maxLado = IMG_MAX_LADO, qualidade = IMG_QUALIDADE) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Imagem inválida'));
            img.onload = () => {
                let { width, height } = img;

                // Se a imagem já é menor que o limite, mantém o tamanho original
                if (width > maxLado || height > maxLado) {
                    if (width >= height) {
                        height = Math.round((height * maxLado) / width);
                        width = maxLado;
                    } else {
                        width = Math.round((width * maxLado) / height);
                        height = maxLado;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // PNG preserva transparência; demais tipos viram JPEG (menor)
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve(canvas.toDataURL(mime, qualidade));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/* ---------------------------------------------------------
   Atualiza o ano do rodapé em qualquer tela que tenha #anoAtual.
   --------------------------------------------------------- */
function atualizarAnoRodape() {
    const el = document.getElementById('anoAtual');
    if (el) el.textContent = new Date().getFullYear();
}

/* =========================================================
   MÓDULO: TELA DE LISTAGEM DE PRODUTOS
   Ativa quando existe #produtosGrid na página.
   ========================================================= */
function initTelaProdutos() {
    const grid = document.getElementById('produtosGrid');
    if (!grid) return;

    function render() {
        const produtos = carregarProdutos();
        grid.innerHTML = '';

        produtos.forEach(p => {
            const card = document.createElement('div');
            card.className = 'produto-card';

            const imagemHtml = p.imagem
                ? `<div class="produto-imagem com-imagem" style="background-image:url('${p.imagem}')"></div>`
                : `<div class="produto-imagem ${corPorId(p.id)}">Imagem do produto</div>`;

            card.innerHTML = `
                ${imagemHtml}
                <p class="produto-nome">${escapeHtml(p.nome)}</p>
                <p class="produto-id">ID: ${escapeHtml(p.codigo || p.id)}</p>
                <p class="produto-descricao">${escapeHtml(p.descricao || 'Sem descrição.')}</p>
                <p class="produto-info-extra">
                    ${formatarMoeda(p.precoVenda)} · ${p.quantidade} un.
                </p>
                <div class="produto-acoes">
                    <button class="btn-editar" data-id="${p.id}" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-excluir" data-id="${p.id}" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });

        grid.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', () => excluir(btn.dataset.id));
        });
        grid.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.href = `novo-produto.html?id=${encodeURIComponent(btn.dataset.id)}`;
            });
        });
    }

    function excluir(id) {
        if (!confirm('Deseja realmente excluir este produto?')) return;
        const produtos = carregarProdutos().filter(p => p.id !== id);
        salvarProdutos(produtos);
        render();
    }

    render();
}

/* =========================================================
   MÓDULO: TELA DE NOVO PRODUTO / EDIÇÃO
   Ativa quando existe #formProduto na página.
   ========================================================= */
function initTelaNovoProduto() {
    const formProduto = document.getElementById('formProduto');
    if (!formProduto) return;

    const inputImagem = document.getElementById('inputImagem');
    const uploadPreview = document.getElementById('uploadPreview');
    const tituloPagina = document.getElementById('tituloPagina');

    let imagemBase64 = null;
    let editandoId = null;

    // Preenche os campos quando há ?id=XXX (modo edição)
    function carregarParaEdicao() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) return;

        const produto = carregarProdutos().find(p => p.id === id);
        if (!produto) return;

        editandoId = id;
        if (tituloPagina) tituloPagina.textContent = 'Editar Produto';

        document.getElementById('nomeProduto').value = produto.nome || '';
        document.getElementById('codigoProduto').value = produto.codigo || '';
        document.getElementById('precoCusto').value = produto.precoCusto || '';
        document.getElementById('categoria').value = produto.categoria || '';
        document.getElementById('unidade').value = produto.unidade || '';
        document.getElementById('precoVenda').value = produto.precoVenda || '';
        document.getElementById('quantidade').value = produto.quantidade || '';
        document.getElementById('descricao').value = produto.descricao || '';

        if (produto.imagem) {
            imagemBase64 = produto.imagem;
            uploadPreview.style.backgroundImage = `url('${produto.imagem}')`;
            uploadPreview.classList.add('com-imagem');
        }
    }

    // Upload de imagem -> redimensiona para tamanho padrão e converte para base64
    inputImagem.addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;

        if (!arquivo.type.startsWith('image/')) {
            alert('Selecione um arquivo de imagem válido.');
            return;
        }

        try {
            imagemBase64 = await redimensionarImagem(arquivo);
            uploadPreview.style.backgroundImage = `url('${imagemBase64}')`;
            uploadPreview.classList.add('com-imagem');
        } catch (err) {
            alert('Não foi possível processar a imagem. Tente outro arquivo.');
            console.error(err);
        }
    });

    // Submit do formulário
    formProduto.addEventListener('submit', (e) => {
        e.preventDefault();

        const produto = {
            id: editandoId || gerarId(),
            nome: document.getElementById('nomeProduto').value.trim(),
            codigo: document.getElementById('codigoProduto').value.trim(),
            precoCusto: parseFloat(document.getElementById('precoCusto').value) || 0,
            categoria: document.getElementById('categoria').value.trim(),
            unidade: document.getElementById('unidade').value.trim(),
            precoVenda: parseFloat(document.getElementById('precoVenda').value) || 0,
            quantidade: parseInt(document.getElementById('quantidade').value, 10) || 0,
            descricao: document.getElementById('descricao').value.trim(),
            imagem: imagemBase64
        };

        const produtos = carregarProdutos();

        if (editandoId) {
            const idx = produtos.findIndex(p => p.id === editandoId);
            if (idx >= 0) produtos[idx] = produto;
        } else {
            produtos.push(produto);
        }

        salvarProdutos(produtos);
        window.location.href = 'produtos.html';
    });

    carregarParaEdicao();
}

/* =========================================================
   INICIALIZAÇÃO - chama todos os módulos.
   Cada um se autodescarta se sua tela não estiver ativa.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    atualizarAnoRodape();
    initTelaProdutos();
    initTelaNovoProduto();
});
