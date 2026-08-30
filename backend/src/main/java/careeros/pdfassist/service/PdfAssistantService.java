private void ensurePdfCollection() {
        QdrantClient client = null;
        try {
            client = new QdrantClient(
                    QdrantGrpcClient.newBuilder(props.getQdrantHost(), props.getQdrantPort(), true)
                            .apiKey(props.getQdrantApiKey())
                            .build());
            try {
                List<String> collections = client.listCollectionsAsync().get(5, TimeUnit.SECONDS);
                if (collections.contains(props.getQdrantCollection())) {
                    log.info("Qdrant collection '{}' already exists for PDF assistant", props.getQdrantCollection());
                    return;
                }
                VectorParams params = VectorParams.newBuilder()
                        .setSize(props.getEmbeddingDimension())
                        .setDistance(Distance.Cosine)
                        .build();
                client.createCollectionAsync(props.getQdrantCollection(), params).get(5, TimeUnit.SECONDS);
                log.info("Created Qdrant collection '{}' for PDF assistant", props.getQdrantCollection());
            } finally {
                if (client != null) {
                    client.close();
                }
            }
        } catch (Exception e) {
            log.warn("Could not ensure Qdrant PDF collection '{}': {}", props.getQdrantCollection(), safeMessage(e));
        }
    }