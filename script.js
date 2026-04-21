class AutorCarlos {
    constructor(nombre) { this._nombre = nombre; }
    mostrar() { return this._nombre; }
}

class MaterialCarlos {
    constructor(codigo, titulo, anio) {
        this._codigo = codigo;
        this._titulo = titulo;
        this._anio = anio;
        this._disponible = true;
    }
    getCodigo() { return this._codigo; }
    getTitulo() { return this._titulo; }
    isDisponible() { return this._disponible; }
    setDisponible(v) { this._disponible = v; }

    mostrar() {
        return `[${this._codigo}] ${this._titulo} - ${this._disponible ? '🟢 DISPONIBLE' : '🔴 PRESTADO'}`;
    }
}

class LibroCarlos extends MaterialCarlos {
    constructor(codigo, titulo, anio, genero, autor) {
        super(codigo, titulo, anio);
        this._genero = genero;
        this._autor = autor;
    }
    mostrar() { return `LIBRO: ${super.mostrar()} | Autor: ${this._autor.mostrar()}`; }
}

class SocioCarlos {
    constructor(cedula, nombre) {
        this._cedula = cedula;
        this._nombre = nombre;
        this._multaAcumulada = 0.0;
        this._prestamosActivos = [];
    }
    getCedula() { return this._cedula; }
    getNombre() { return this._nombre; }
    getMulta() { return this._multaAcumulada; }
    setMulta(v) { this._multaAcumulada = v; }
    getPrestamos() { return this._prestamosActivos; }
    
    agregarPrestamo(p) { this._prestamosActivos.push(p); }
    
  
    finalizarPrestamo(codigoMaterial) {
        this._prestamosActivos = this._prestamosActivos.filter(p => p.getMaterial().getCodigo() !== codigoMaterial);
    }

    mostrar() {
        return `SOCIO: ${this._nombre} | CC: ${this._cedula} | Multa: $${this._multaAcumulada.toFixed(2)} | Activos: ${this._prestamosActivos.length}`;
    }
}

class PrestamoCarlos {
    constructor(material, socio, diasPlazo) {
        this._material = material;
        this._socio = socio;
        this._diasPlazo = diasPlazo;
        this._fecha = new Date().toLocaleDateString();
        this._material.setDisponible(false);
    }
    getMaterial() { return this._material; }
    
    calcularMulta(diasRetraso) {
        return diasRetraso > 0 ? diasRetraso * 0.80 : 0;
    }

    mostrar() {
        return `Material: ${this._material.getTitulo()} | Fecha: ${this._fecha} | Plazo: ${this._diasPlazo} días`;
    }
}

class BibliotecaCarlos {
    constructor(nombre) {
        this._nombre = nombre;
        this._materiales = [];
        this._socios = [];
    }

    buscarMaterial(cod) { return this._materiales.find(m => m.getCodigo() === cod); }
    buscarSocio(ced) { return this._socios.find(s => s.getCedula() === ced); }

    realizarPrestamo(codMaterial, cedSocio, dias) {
        const material = this.buscarMaterial(codMaterial);
        const socio = this.buscarSocio(cedSocio);

        if (!material || !socio) return "Error: Material o Socio no encontrado.";
        if (!material.isDisponible()) return "Error: El material ya está prestado.";

        const nuevoPrestamo = new PrestamoCarlos(material, socio, dias);
        socio.agregarPrestamo(nuevoPrestamo);
        return `Préstamo realizado con éxito a ${socio.getNombre()}.`;
    }

    procesarDevolucion(codMaterial, cedSocio, diasRetraso) {
        const socio = this.buscarSocio(cedSocio);
        if (!socio) return "Error: Socio no encontrado.";

        const material = this.buscarMaterial(codMaterial);
        if (!material) return "Error: Material no encontrado.";

        const multa = diasRetraso * 0.80;
        socio.setMulta(socio.getMulta() + multa);
        socio.finalizarPrestamo(codMaterial);
        material.setDisponible(true);

        return `Devolución exitosa. Multa generada: $${multa.toFixed(2)}. Total deuda: $${socio.getMulta().toFixed(2)}`;
    }


    agregarMaterial(m) {
        if (this.buscarMaterial(m.getCodigo())) return false;
        this._materiales.push(m); return true;
    }
    agregarSocio(s) {
        if (this.buscarSocio(s.getCedula())) return false;
        this._socios.push(s); return true;
    }

    mostrarCatalogo() {
        let res = `--- CATÁLOGO ---\n`;
        this._materiales.forEach(m => res += m.mostrar() + "\n");
        this.render(res);
    }

    mostrarSocios() {
        let res = `--- SOCIOS Y DEUDAS ---\n`;
        this._socios.forEach(s => {
            res += s.mostrar() + "\n";
            s.getPrestamos().forEach(p => res += "  > " + p.mostrar() + "\n");
        });
        this.render(res);
    }

    render(t) { document.getElementById('consola').innerText = t; }
}

const biblioteca = new BibliotecaCarlos("Biblioteca Unisalamanca");



function uiPrestar() {
    const cod = prompt("Ingrese Código del Material:");
    const ced = prompt("Ingrese Cédula del Socio:");
    const dias = parseInt(prompt("Días de plazo:"), 10);
    
    const msj = biblioteca.realizarPrestamo(cod, ced, dias);
    biblioteca.render(msj);
}

function uiDevolver() {
    const cod = prompt("Código del Material que devuelve:");
    const ced = prompt("Cédula del Socio:");
    const retraso = parseInt(prompt("Días de retraso (0 si entregó a tiempo):"), 10);
    
    const msj = biblioteca.procesarDevolucion(cod, ced, retraso);
    biblioteca.render(msj);
}


function uiAgregarLibro() {
    const cod = document.getElementById('l-cod').value;
    const tit = document.getElementById('l-tit').value;
    const aut = document.getElementById('l-aut').value;
    if(biblioteca.agregarMaterial(new LibroCarlos(cod, tit, 2024, "General", new AutorCarlos(aut)))) {
        biblioteca.render(`Libro ${tit} guardado.`);
    } else { alert("Código duplicado"); }
}

function uiAgregarSocio() {
    const ced = document.getElementById('s-ced').value;
    const nom = document.getElementById('s-nom').value;
    if(biblioteca.agregarSocio(new SocioCarlos(ced, nom))) {
        biblioteca.render(`Socio ${nom} registrado.`);
    } else { alert("Cédula duplicada"); }
}

function inicializarSistema() {
    biblioteca.agregarMaterial(new LibroCarlos("1", "Cien Años de Soledad", 1967, "Ficción", new AutorCarlos("Gabriel Garcia Marquez")));
    biblioteca.agregarMaterial(new LibroCarlos("2", "El Corazon Delator", 1843, "Terror, Ficción gótica", new AutorCarlos("Edgar Allan Poe")));
    biblioteca.agregarMaterial(new LibroCarlos("3", "La Iliada", 1967, "Épico", new AutorCarlos("Homero")));
    biblioteca.agregarSocio(new SocioCarlos("1127578034", "Carlos Sarabia"));
    biblioteca.agregarSocio(new SocioCarlos("1127578035", "Harold Gereda"));
    biblioteca.agregarSocio(new SocioCarlos("98626794", "Wber Vallejo"));
    biblioteca.render("Sistema con datos de prueba.");
}