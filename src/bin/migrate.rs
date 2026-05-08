use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Mask password for display
    let display_url = if let Some(at) = database_url.find('@') {
        format!("***@{}", &database_url[at + 1..])
    } else {
        "***".to_string()
    };
    println!("connecting to: {display_url}");

    let db = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("failed to connect to database");

    println!("connected, running migrations...\n");

    let migrator = sqlx::migrate!("./migrations");

    // Show all known migrations
    for m in migrator.iter() {
        println!("  found: v{} — {}", m.version, m.description);
    }

    // Check which have already been applied
    let applied: Vec<_> = sqlx::query_scalar::<_, i64>(
        "SELECT version FROM _sqlx_migrations ORDER BY version",
    )
    .fetch_all(&db)
    .await
    .unwrap_or_default();

    println!("\n  already applied: {:?}", applied);

    let pending: Vec<_> = migrator
        .iter()
        .filter(|m| !applied.contains(&m.version))
        .collect();

    if pending.is_empty() {
        println!("\n  no pending migrations.");
    } else {
        println!("\n  pending:");
        for m in &pending {
            println!("    v{} — {}", m.version, m.description);
        }
    }

    println!();
    migrator.run(&db).await.expect("failed to run migrations");
    println!("migrations complete!");
}
