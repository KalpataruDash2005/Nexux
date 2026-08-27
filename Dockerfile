FROM qdrant/qdrant

# Qdrant data directory for persistence
RUN mkdir -p /qdrant/data && chown -R qdrant:qdrant /qdrant/data

# Qdrant ports: 6333 (gRPC), 6334 (REST API)
EXPOSE 6333 6334

# Start Qdrant service with data directory
CMD ["qdrant", "run", "--background", "--dev-path", "/qdrant/data"]