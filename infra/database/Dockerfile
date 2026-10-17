FROM postgres:16-alpine
# El entrypoint oficial solo usa «gosu postgres comando ...».
# su-exec mantiene UID/GID, exec y señales sin incorporar el runtime Go de gosu.
# Verificar una sola sustitución: fallar si cambia el contrato del entrypoint base.
RUN apk add --no-cache su-exec \
    && test "$(grep -c 'exec gosu postgres ' /usr/local/bin/docker-entrypoint.sh)" -eq 1 \
    && sed -i 's/exec gosu postgres /exec su-exec postgres /' /usr/local/bin/docker-entrypoint.sh \
    && rm /usr/local/bin/gosu \
    && test "$(su-exec postgres id -un)" = postgres
