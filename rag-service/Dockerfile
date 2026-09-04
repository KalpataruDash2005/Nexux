FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies first to cache them
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
# Copy the built jar from the build stage
COPY --from=build /app/target/*.jar app.jar

# Expose a default port (Render will override this dynamically)
EXPOSE 8081

# Use the shell form of ENTRYPOINT so the PORT environment variable 
# injected by Render is evaluated at runtime and overrides the hardcoded 8081.
ENTRYPOINT sh -c "java -Dserver.port=${PORT:-8081} -jar app.jar"
