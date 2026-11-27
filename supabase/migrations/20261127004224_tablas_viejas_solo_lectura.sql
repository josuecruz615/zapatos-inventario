-- La interfaz nueva ya está publicada: las tablas del sistema anterior quedan en solo lectura
-- para que nadie registre ahí por error (por ejemplo, con la página vieja abierta en otro teléfono).
-- Se pueden borrar más adelante; el respaldo está en el esquema respaldo_20261126.
revoke insert, update, delete, truncate on public."INVENTARIO", public."CLIENTE", public."VENTAS", public."DETALLE_VENTAS" from anon, authenticated;
