FROM postgres:17

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    postgresql-server-dev-17 \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/fboulnois/pg_uuidv7.git /tmp/pg_uuidv7 \
    && cd /tmp/pg_uuidv7 \
    && make \
    && make install \
    && rm -rf /tmp/pg_uuidv7

COPY init.sql /docker-entrypoint-initdb.d/