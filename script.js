// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://ptucbogjbndiiehaknet.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_CZbWLmhi_ANjcxAWqJbazg_Rk0oF8Yt'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// CLASES Y LÓGICA DE LA BIBLIOTECA
// ==========================================
class BibliotecaCarlos {
    constructor(nombre) {
        this._nombre = nombre;
    }

    render(t) { 
        document.getElementById('consola').innerText = t; 
    }

    // --- CATÁLOGO (LIBROS) ---
    async agregarLibroBD(codigo, titulo, anio, genero, autor) {
        const { data, error } = await supabaseClient
            .from('libros')
            .insert([{ codigo, titulo, anio: parseInt(anio), genero, autor, disponible: true }]);

        if (error) {
            console.error(error);
            return "Error al registrar libro: " + error.message;
        }
        return `Libro "${titulo}" guardado exitosamente.`;
    }

    async mostrarCatalogo() {
        const { data: libros, error } = await supabaseClient
            .from('libros')
            .select('*');

        if (error) {
            this.render("Error al cargar catálogo: " + error.message);
            return;
        }

        let res = `--- CATÁLOGO ---\n`;
        if (libros.length === 0) {
            res += "No hay libros registrados.";
        } else {
            libros.forEach(m => {
                const estado = m.disponible ? '🟢 DISPONIBLE' : '🔴 PRESTADO';
                res += `[${m.codigo}] ${m.titulo} (${m.anio}) - ${m.genero} | Autor: ${m.autor} - ${estado}\n`;
            });
        }
        this.render(res);
    }

    // --- SOCIOS ---
    async agregarSocioBD(cedula, nombre) {
        const { data, error } = await supabaseClient
            .from('socios')
            .insert([{ cedula, nombre, multa_acumulada: 0.0 }]);

        if (error) {
            console.error(error);
            return "Error al registrar socio: " + error.message;
        }
        return `Socio "${nombre}" registrado exitosamente.`;
    }

    async mostrarSocios() {
        const { data: socios, error } = await supabaseClient
            .from('socios')
            .select('*');

        if (error) {
            this.render("Error al cargar socios: " + error.message);
            return;
        }

        let res = `--- SOCIOS Y DEUDAS ---\n`;
        if (socios.length === 0) {
            res += "No hay socios registrados.";
        } else {
            socios.forEach(s => {
                res += `SOCIO: ${s.nombre} | CC: ${s.cedula} | Multa: $${Number(s.multa_acumulada).toFixed(2)}\n`;
            });
        }
        this.render(res);
    }

    // --- PRÉSTAMOS ---
    async realizarPrestamo(codMaterial, cedSocio, dias) {
        // 1. Verificar si el libro existe y está disponible
        const { data: libro, error: errLibro } = await supabaseClient
            .from('libros')
            .select('*')
            .eq('codigo', codMaterial)
            .single();

        if (errLibro || !libro) return "Error: Material no encontrado.";
        if (!libro.disponible) return "Error: El material ya está prestado.";

        // 2. Verificar si el socio existe
        const { data: socio, error: errSocio } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('cedula', cedSocio)
            .single();

        if (errSocio || !socio) return "Error: Socio no encontrado.";

        // 3. Registrar el préstamo y actualizar la disponibilidad del libro
        const { error: errPrestamo } = await supabaseClient
            .from('prestamos')
            .insert([{ codigo_libro: codMaterial, cedula_socio: cedSocio, dias_plazo: dias }]);

        if (errPrestamo) return "Error al registrar préstamo: " + errPrestamo.message;

        await supabaseClient
            .from('libros')
            .update({ disponible: false })
            .eq('codigo', codMaterial);

        return `Préstamo realizado con éxito a ${socio.nombre}.`;
    }

    // --- DEVOLUCIONES ---
    async procesarDevolucion(codMaterial, cedSocio, diasRetraso) {
        const { data: socio, error: errSocio } = await supabaseClient
            .from('socios')
            .select('*')
            .eq('cedula', cedSocio)
            .single();

        if (errSocio || !socio) return "Error: Socio no encontrado.";

        const multaCalculada = diasRetraso > 0 ? diasRetraso * 0.80 : 0;
        const nuevaMulta = Number(socio.multa_acumulada) + multaCalculada;

        // Actualizar multa del socio
        await supabaseClient
            .from('socios')
            .update({ multa_acumulada: nuevaMulta })
            .eq('cedula', cedSocio);

        // Marcar libro como disponible de nuevo
        await supabaseClient
            .from('libros')
            .update({ disponible: true })
            .eq('codigo', codMaterial);

        return `Devolución exitosa. Multa generada: $${multaCalculada.toFixed(2)}. Total deuda: $${nuevaMulta.toFixed(2)}`;
    }

    // --- ELIMINAR REGISTROS ---
    async eliminarLibro(codigo) {
        const { error } = await supabaseClient.from('libros').delete().eq('codigo', codigo);
        if (error) return "Error al eliminar libro: " + error.message;
        return `Libro con código ${codigo} eliminado.`;
    }

    async eliminarSocio(cedula) {
        const { error } = await supabaseClient.from('socios').delete().eq('cedula', cedula);
        if (error) return "Error al eliminar socio: " + error.message;
        return `Socio con cédula ${cedula} eliminado.`;
    }
}

const biblioteca = new BibliotecaCarlos("Biblioteca Unisalamanca");

// ==========================================
// FUNCIONES DE LA INTERFAZ (UI)
// ==========================================
async function uiAgregarLibro() {
    const cod = document.getElementById('l-cod').value;
    const tit = document.getElementById('l-tit').value;
    const anio = document.getElementById('l-anio').value;
    const gen = document.getElementById('l-gen').value;
    const aut = document.getElementById('l-aut').value;

    if (!cod || !tit) {
        alert("Por favor llena al menos el código y el título.");
        return;
    }

    const msj = await biblioteca.agregarLibroBD(cod, tit, anio, gen, aut);
    biblioteca.render(msj);
}

async function uiAgregarSocio() {
    const ced = document.getElementById('s-ced').value;
    const nom = document.getElementById('s-nom').value;

    if (!ced || !nom) {
        alert("Por favor llena todos los campos del socio.");
        return;
    }

    const msj = await biblioteca.agregarSocioBD(ced, nom);
    biblioteca.render(msj);
}

async function uiPrestar() {
    const cod = prompt("Ingrese Código del Material:");
    const ced = prompt("Ingrese Cédula del Socio:");
    const dias = parseInt(prompt("Días de plazo:"), 10);
    
    if (!cod || !ced) return;
    const msj = await biblioteca.realizarPrestamo(cod, ced, dias);
    biblioteca.render(msj);
}

async function uiDevolver() {
    const cod = prompt("Código del Material que devuelve:");
    const ced = prompt("Cédula del Socio:");
    const retraso = parseInt(prompt("Días de retraso (0 si entregó a tiempo):"), 10);
    
    if (!cod || !ced) return;
    const msj = await biblioteca.procesarDevolucion(cod, ced, retraso);
    biblioteca.render(msj);
}

async function uiEliminarLibro() {
    const id = document.getElementById('del-id').value;
    if (!id) { alert("Ingresa un código de libro"); return; }
    const msj = await biblioteca.eliminarLibro(id);
    biblioteca.render(msj);
}

async function uiEliminarSocio() {
    const id = document.getElementById('del-id').value;
    if (!id) { alert("Ingresa una cédula de socio"); return; }
    const msj = await biblioteca.eliminarSocio(id);
    biblioteca.render(msj);
}