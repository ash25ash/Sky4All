import 'dart:convert';
import 'dart:io';

const String kDittoDatabaseId = '965957f9-6fd7-4d2f-8794-d8f1544c5724';
const String kDittoCloudUrl = 'https://i83inp.cloud.dittolive.app';
const String kDittoEndpoint =
    'i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724';
const String kDittoDqlUrl =
    'https://i83inp.cloud.dittolive.app/api/v4/store/execute';
const String kSqlServerInstance = r'localhost';
const String kSqlDatabaseName = 'Sky4All';

Future<void> main() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 3001);
  stdout.writeln(
    '====================================================================',
  );
  stdout.writeln(
    'Sky4All Global SQL Server 22 ⇄ Ditto Big Peer Sync Server listening',
  );
  stdout.writeln('Localhost URL:      http://localhost:3001');
  stdout.writeln('Ditto Database ID:  $kDittoDatabaseId');
  stdout.writeln('Ditto Cloud URL:    $kDittoCloudUrl');
  stdout.writeln('Ditto Endpoint:     $kDittoEndpoint');
  stdout.writeln('SQL Database Name:  $kSqlDatabaseName');
  stdout.writeln(
    '====================================================================',
  );

  await for (final HttpRequest req in server) {
    req.response.headers.add('Access-Control-Allow-Origin', '*');
    req.response.headers
        .add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    req.response.headers
        .add('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method == 'OPTIONS') {
      req.response.statusCode = HttpStatus.noContent;
      await req.response.close();
      continue;
    }

    if (req.method == 'POST' && req.uri.path == '/api/sync/pre-flight') {
      final bodyStr = await utf8.decoder.bind(req).join();
      stdout.writeln('[PRE-FLIGHT SYNC] Request received: $bodyStr');

      await _runSqlCommand(
        "EXEC dbo.usp_PreFlightSyncToDitto @FlightNumber = 'BA123', @FlightDate = '31/10/2026';",
      );

      req.response.statusCode = HttpStatus.ok;
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
          'ok': true,
          'phase': 'PRE_FLIGHT_SYNC',
          'databaseId': kDittoDatabaseId,
          'cloudUrlEndpoint': kDittoEndpoint,
          'flightNumber': 'BA123',
          'flightDate': '31/10/2026',
        }),
      );
      await req.response.close();
      continue;
    }

    if (req.method == 'POST' && req.uri.path == '/api/sync/post-flight') {
      final bodyStr = await utf8.decoder.bind(req).join();
      final data = jsonDecode(bodyStr) as Map<String, dynamic>;
      final collections =
          (data['collections'] as Map<String, dynamic>?) ?? <String, dynamic>{};

      final passengers = (collections['passengers'] as List<dynamic>?) ?? [];
      final requests = (collections['requests'] as List<dynamic>?) ?? [];
      final orders = (collections['orders'] as List<dynamic>?) ?? [];
      final ratings = (collections['flightRatings'] as List<dynamic>?) ?? [];
      final complaints =
          (collections['seatComplaints'] as List<dynamic>?) ?? [];
      final paxRatings =
          (collections['passengerRatings'] as List<dynamic>?) ?? [];

      final totalRecords = passengers.length +
          requests.length +
          orders.length +
          ratings.length +
          complaints.length +
          paxRatings.length;

      stdout.writeln(
        '[POST-FLIGHT SYNC] Uploading $totalRecords records to Ditto ($kDittoEndpoint) and SQL Server ($kSqlDatabaseName)...',
      );

      for (final p in passengers) {
        final map = p as Map<String, dynamic>;
        await _pushToDitto('passengers', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final name = _sqlEsc(map['name']?.toString() ?? '');
        final seat = _sqlEsc(map['seat']?.toString() ?? '');
        final flightId = _sqlEsc(map['flightId']?.toString() ?? 'BA123');
        final medJson =
            _sqlEsc(jsonEncode(map['medicalConditions'] ?? <dynamic>[]));
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.Passengers WHERE Id = N'$id') "
          "INSERT INTO dbo.Passengers (Id, Name, Seat, FlightId, FlightDate, MedicalConditionsJson) "
          "VALUES (N'$id', N'$name', N'$seat', N'$flightId', N'31/10/2026', N'$medJson') "
          "ELSE UPDATE dbo.Passengers SET MedicalConditionsJson = N'$medJson', UpdatedAt = SYSUTCDATETIME() WHERE Id = N'$id';",
        );
      }

      for (final r in requests) {
        final map = r as Map<String, dynamic>;
        await _pushToDitto('requests', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final type = _sqlEsc(map['type']?.toString() ?? '');
        final seat = _sqlEsc(map['seat']?.toString() ?? '');
        final payloadJson =
            _sqlEsc(jsonEncode(map['payload'] ?? <String, dynamic>{}));
        final status = _sqlEsc(map['status']?.toString() ?? 'new');
        final createdAt = (map['createdAt'] as num?)?.toInt() ?? 0;
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.Requests WHERE Id = N'$id') "
          "INSERT INTO dbo.Requests (Id, Type, Seat, FlightId, FlightDate, PayloadJson, Status, CreatedAt) "
          "VALUES (N'$id', N'$type', N'$seat', N'BA123', N'31/10/2026', N'$payloadJson', N'$status', $createdAt) "
          "ELSE UPDATE dbo.Requests SET Status = N'$status', SyncedAt = SYSUTCDATETIME() WHERE Id = N'$id';",
        );
      }

      for (final o in orders) {
        final map = o as Map<String, dynamic>;
        await _pushToDitto('orders', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final seat = _sqlEsc(map['seat']?.toString() ?? '');
        final itemsJson = _sqlEsc(jsonEncode(map['items'] ?? <dynamic>[]));
        final status = _sqlEsc(map['status']?.toString() ?? 'new');
        final createdAt = (map['createdAt'] as num?)?.toInt() ?? 0;
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.Orders WHERE Id = N'$id') "
          "INSERT INTO dbo.Orders (Id, Seat, FlightId, FlightDate, ItemsJson, Status, CreatedAt) "
          "VALUES (N'$id', N'$seat', N'BA123', N'31/10/2026', N'$itemsJson', N'$status', $createdAt) "
          "ELSE UPDATE dbo.Orders SET Status = N'$status', SyncedAt = SYSUTCDATETIME() WHERE Id = N'$id';",
        );
      }

      for (final fr in ratings) {
        final map = fr as Map<String, dynamic>;
        await _pushToDitto('flightRatings', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final seat = _sqlEsc(map['seat']?.toString() ?? '');
        final turbulence = (map['turbulence'] as num?)?.toInt() ?? 3;
        final staffBehaviour = (map['staffBehaviour'] as num?)?.toInt() ?? 3;
        final cleanliness = (map['cleanliness'] as num?)?.toInt() ?? 3;
        final legroom = (map['legroom'] as num?)?.toInt() ?? 3;
        final bagSpace = (map['bagSpace'] as num?)?.toInt() ?? 3;
        final comment = _sqlEsc(map['comment']?.toString() ?? '');
        final createdAt = (map['createdAt'] as num?)?.toInt() ?? 0;
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.FlightRatings WHERE Id = N'$id') "
          "INSERT INTO dbo.FlightRatings (Id, Seat, FlightId, FlightDate, Turbulence, StaffBehaviour, Cleanliness, Legroom, BagSpace, Comment, CreatedAt) "
          "VALUES (N'$id', N'$seat', N'BA123', N'31/10/2026', $turbulence, $staffBehaviour, $cleanliness, $legroom, $bagSpace, N'$comment', $createdAt);",
        );
      }

      for (final sc in complaints) {
        final map = sc as Map<String, dynamic>;
        await _pushToDitto('seatComplaints', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final fromSeat = _sqlEsc(map['fromSeat']?.toString() ?? '');
        final targetSeat = _sqlEsc(map['targetSeat']?.toString() ?? '');
        final category = _sqlEsc(map['category']?.toString() ?? 'other');
        final text = _sqlEsc(map['text']?.toString() ?? '');
        final createdAt = (map['createdAt'] as num?)?.toInt() ?? 0;
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.SeatComplaints WHERE Id = N'$id') "
          "INSERT INTO dbo.SeatComplaints (Id, FromSeat, TargetSeat, FlightId, FlightDate, Category, Text, CreatedAt) "
          "VALUES (N'$id', N'$fromSeat', N'$targetSeat', N'BA123', N'31/10/2026', N'$category', N'$text', $createdAt);",
        );
      }

      for (final pr in paxRatings) {
        final map = pr as Map<String, dynamic>;
        await _pushToDitto('passengerRatings', map);
        final id = _sqlEsc(map['id']?.toString() ?? '');
        final seat = _sqlEsc(map['seat']?.toString() ?? '');
        final score = (map['score'] as num?)?.toInt() ?? 3;
        final note = _sqlEsc(map['note']?.toString() ?? '');
        final createdAt = (map['createdAt'] as num?)?.toInt() ?? 0;
        await _runSqlCommand(
          "IF NOT EXISTS (SELECT 1 FROM dbo.PassengerRatings WHERE Id = N'$id') "
          "INSERT INTO dbo.PassengerRatings (Id, Seat, FlightId, FlightDate, Score, Note, CreatedAt) "
          "VALUES (N'$id', N'$seat', N'BA123', N'31/10/2026', $score, N'$note', $createdAt);",
        );
      }

      await _runSqlCommand(
        "EXEC dbo.usp_PostFlightSyncFromDitto @FlightNumber = 'BA123', @FlightDate = '31/10/2026', @RecordsCount = $totalRecords;",
      );

      req.response.statusCode = HttpStatus.ok;
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
          'ok': true,
          'phase': 'POST_FLIGHT_SYNC',
          'databaseId': kDittoDatabaseId,
          'cloudUrlEndpoint': kDittoEndpoint,
          'sqlDatabase': kSqlDatabaseName,
          'recordsSyncedToSqlServer': totalRecords,
        }),
      );
      await req.response.close();
      continue;
    }

    req.response.statusCode = HttpStatus.ok;
    req.response.headers.contentType = ContentType.json;
    req.response.write(
      jsonEncode({
        'service': 'Sky4All Global SQL Server 22 & Ditto Big Peer Sync Server',
        'dittoDatabaseId': kDittoDatabaseId,
        'dittoCloudUrl': kDittoCloudUrl,
        'dittoEndpoint': kDittoEndpoint,
        'sqlDatabase': kSqlDatabaseName,
        'status': 'online',
      }),
    );
    await req.response.close();
  }
}

String _sqlEsc(String val) => val.replaceAll("'", "''");

Future<void> _pushToDitto(
  String collection,
  Map<String, dynamic> doc,
) async {
  try {
    final client = HttpClient();
    final request = await client.postUrl(Uri.parse(kDittoDqlUrl));
    request.headers.set('Content-Type', 'application/json');
    request.headers.set('X-Ditto-Database-Id', kDittoDatabaseId);
    final payload = {
      'statement':
          'INSERT INTO $collection DOCUMENTS (:doc) ON ID CONFLICT DO UPDATE',
      'arguments': {
        'doc': {
          ...doc,
          '_id': doc['id'],
          'flightId': 'BA123',
          'flightDate': '31/10/2026',
        },
      },
    };
    request.add(utf8.encode(jsonEncode(payload)));
    final response = await request.close();
    await response.drain<void>();
    client.close();
  } catch (_) {}
}

Future<void> _runSqlCommand(String query) async {
  try {
    await Process.run('sqlcmd', [
      '-S',
      kSqlServerInstance,
      '-d',
      kSqlDatabaseName,
      '-E',
      '-C',
      '-Q',
      query,
    ]);
  } catch (_) {}
}
