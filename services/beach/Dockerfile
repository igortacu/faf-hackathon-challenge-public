FROM gradle:8.8-jdk21 AS builder
WORKDIR /app
COPY build.gradle.kts settings.gradle.kts gradle.properties ./
COPY gradle ./gradle
COPY src ./src
RUN gradle buildFatJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=builder /app/build/libs/*-all.jar app.jar
COPY --from=builder /app/src/main/resources/documentation.yaml openapi/documentation.yaml
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
