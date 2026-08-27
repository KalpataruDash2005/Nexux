FROM qdrant/qdrant

# Qdrant ports: 6333 (gRPC), 6334 (REST API)
EXPOSE 6333 6334

# Start Qdrant service
CMD ["qdrant", "run", "--background"]