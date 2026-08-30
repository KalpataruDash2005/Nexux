FROM qdrant/qdrant

# Start Qdrant service
CMD ["qdrant", "run", "--background"]