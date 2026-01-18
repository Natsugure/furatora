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

RUN echo "\\c main\nCREATE EXTENSION IF NOT EXISTS pg_uuidv7;" > /docker-entrypoint-initdb.d/01-pg_uuidv7.sql