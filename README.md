# Organizador de centros Junta de Andalucía

Web local para ordenar centros por distancia a una calle, pueblo o código postal, con filtros y exportación.

## Qué hace

- Une los CSV de `database` en un único listado.
- Cruza los centros con el directorio oficial de la Junta para obtener coordenadas.
- Permite filtrar por tipo de centro, varias provincias a la vez, localidad, bilingüe y lista de origen.
- Añade filtros especiales para centros `Voluntarios`, `ZTS` y de `Difícil desempeño` a partir de los PDF de la carpeta `database`.
- Ordena por distancia desde un punto introducido por texto.
- Exporta los resultados visibles a `CSV`, `XLSX` y `PDF`.
- Copia al portapapeles el orden actual de códigos.

## Cómo abrirla

La forma más cómoda:

```powershell
.\start_app.ps1
```

Eso abre la web en tu navegador y deja un servidor local funcionando mientras la ventana siga abierta.

También puedes abrir [index.html](./index.html) directamente, aunque el modo con servidor local suele dar menos problemas con navegadores.

1. Abre la web.
2. Escribe una calle, localidad o código postal.
3. Pulsa `Ordenar por distancia`.

La geocodificación del punto de origen usa OpenStreetMap Nominatim, así que hace falta internet para localizar la dirección que escribas.

## Cómo regenerar los datos

Si cambias o añades CSV en `database`, vuelve a generar el dataset:

```powershell
python .\scripts\build_dataset.py
```

Después recarga `index.html`.

Los PDF de `Voluntario`, `ZTS` y `Difícil desempeño` también se cruzan automáticamente al regenerar.

## Notas

- Los CSV actuales no incluyen una marca explícita de `difícil desempeño`. Si añades un CSV con esa categoría a `database`, aparecerá como lista de origen al regenerar los datos.
- Hay un centro del cruce actual sin coordenadas oficiales; al ordenar por distancia se envía al final.
