USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'Sky4All')
BEGIN
    CREATE DATABASE Sky4All;
END
GO

USE Sky4All;
GO

IF OBJECT_ID('dbo.SyncAuditLogs', 'U') IS NOT NULL DROP TABLE dbo.SyncAuditLogs;
IF OBJECT_ID('dbo.PassengerRatings', 'U') IS NOT NULL DROP TABLE dbo.PassengerRatings;
IF OBJECT_ID('dbo.SeatComplaints', 'U') IS NOT NULL DROP TABLE dbo.SeatComplaints;
IF OBJECT_ID('dbo.FlightRatings', 'U') IS NOT NULL DROP TABLE dbo.FlightRatings;
IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DROP TABLE dbo.Orders;
IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL DROP TABLE dbo.Requests;
IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DROP TABLE dbo.Products;
IF OBJECT_ID('dbo.Passengers', 'U') IS NOT NULL DROP TABLE dbo.Passengers;
IF OBJECT_ID('dbo.Stewards', 'U') IS NOT NULL DROP TABLE dbo.Stewards;
IF OBJECT_ID('dbo.Flights', 'U') IS NOT NULL DROP TABLE dbo.Flights;
GO

CREATE TABLE dbo.Flights (
    FlightId NVARCHAR(64) NOT NULL PRIMARY KEY,
    FlightNumber NVARCHAR(20) NOT NULL,
    FlightDate NVARCHAR(20) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    LastSyncedAt DATETIME2 NULL
);
GO

CREATE TABLE dbo.Stewards (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Password NVARCHAR(256) NOT NULL,
    FlightNumber NVARCHAR(20) NOT NULL,
    FlightDate NVARCHAR(20) NOT NULL,
    FullName NVARCHAR(150) NOT NULL
);
GO

CREATE TABLE dbo.Passengers (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Name NVARCHAR(150) NOT NULL,
    Seat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL,
    FlightDate NVARCHAR(20) NOT NULL,
    MedicalConditionsJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.Products (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Name NVARCHAR(150) NOT NULL,
    Detail NVARCHAR(50) NOT NULL,
    PriceCents INT NOT NULL DEFAULT 300,
    Category NVARCHAR(30) NOT NULL,
    ImageAsset NVARCHAR(255) NOT NULL
);
GO

CREATE TABLE dbo.Requests (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Type NVARCHAR(40) NOT NULL,
    Seat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL DEFAULT 'BA123',
    FlightDate NVARCHAR(20) NOT NULL DEFAULT '31/10/2026',
    PayloadJson NVARCHAR(MAX) NULL,
    Status NVARCHAR(20) NOT NULL,
    CreatedAt BIGINT NOT NULL,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.Orders (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Seat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL DEFAULT 'BA123',
    FlightDate NVARCHAR(20) NOT NULL DEFAULT '31/10/2026',
    ItemsJson NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    CreatedAt BIGINT NOT NULL,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.FlightRatings (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Seat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL DEFAULT 'BA123',
    FlightDate NVARCHAR(20) NOT NULL DEFAULT '31/10/2026',
    Turbulence INT NOT NULL CHECK (Turbulence BETWEEN 1 AND 5),
    StaffBehaviour INT NOT NULL CHECK (StaffBehaviour BETWEEN 1 AND 5),
    Cleanliness INT NOT NULL CHECK (Cleanliness BETWEEN 1 AND 5),
    Legroom INT NOT NULL CHECK (Legroom BETWEEN 1 AND 5),
    BagSpace INT NOT NULL CHECK (BagSpace BETWEEN 1 AND 5),
    Comment NVARCHAR(MAX) NULL,
    CreatedAt BIGINT NOT NULL,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.SeatComplaints (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    FromSeat NVARCHAR(10) NOT NULL,
    TargetSeat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL DEFAULT 'BA123',
    FlightDate NVARCHAR(20) NOT NULL DEFAULT '31/10/2026',
    Category NVARCHAR(20) NOT NULL,
    Text NVARCHAR(MAX) NOT NULL,
    CreatedAt BIGINT NOT NULL,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.PassengerRatings (
    Id NVARCHAR(64) NOT NULL PRIMARY KEY,
    Seat NVARCHAR(10) NOT NULL,
    FlightId NVARCHAR(20) NOT NULL DEFAULT 'BA123',
    FlightDate NVARCHAR(20) NOT NULL DEFAULT '31/10/2026',
    Score INT NOT NULL CHECK (Score BETWEEN 1 AND 5),
    Note NVARCHAR(MAX) NOT NULL,
    CreatedAt BIGINT NOT NULL,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.SyncAuditLogs (
    LogId INT IDENTITY(1,1) PRIMARY KEY,
    SyncPhase NVARCHAR(30) NOT NULL,
    DittoDatabaseId NVARCHAR(64) NOT NULL,
    DittoCloudEndpoint NVARCHAR(255) NOT NULL,
    FlightNumber NVARCHAR(20) NOT NULL,
    FlightDate NVARCHAR(20) NOT NULL,
    RecordsSynced INT NOT NULL DEFAULT 0,
    SyncedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Details NVARCHAR(MAX) NULL
);
GO

INSERT INTO dbo.Flights (FlightId, FlightNumber, FlightDate, Status, LastSyncedAt)
VALUES ('BA123_31-10-2026', 'BA123', '31/10/2026', 'ACTIVE', SYSUTCDATETIME());

INSERT INTO dbo.Stewards (Id, Username, Password, FlightNumber, FlightDate, FullName)
VALUES ('steward_patrutbm5d', 'patrutbm5d', '123456', 'BA123', '31/10/2026', 'Patrut B.');

INSERT INTO dbo.Passengers (Id, Name, Seat, FlightId, FlightDate, MedicalConditionsJson)
VALUES
    ('p_popa_andreea', 'Popa Andreea', 'C10', 'BA123', '31/10/2026', '["Asthma"]'),
    ('p_radoi_laura',  'Radoi Laura',  'D5',  'BA123', '31/10/2026', '["Diabetes"]');

INSERT INTO dbo.Products (Id, Name, Detail, PriceCents, Category, ImageAsset)
VALUES
    ('prod_01', 'Coca-Cola Original', '330 ml', 300, 'drinks', 'assets/images/menu-cola.jpg'),
    ('prod_02', 'Coca-Cola Zero Sugar', '330 ml', 300, 'drinks', 'assets/images/menu-cola-zero.jpg'),
    ('prod_03', 'Fanta Orange', '330 ml', 300, 'drinks', 'assets/images/menu-fanta.jpg'),
    ('prod_04', 'Sprite Lemon-Lime', '330 ml', 300, 'drinks', 'assets/images/menu-sprite.jpg'),
    ('prod_05', 'Pepsi', '330 ml', 300, 'drinks', 'assets/images/menu-pepsi.jpg'),
    ('prod_06', '7UP', '330 ml', 300, 'drinks', 'assets/images/menu-7up.jpg'),
    ('prod_07', 'evian', '500 ml', 250, 'drinks', 'assets/images/menu-evian.jpg'),
    ('prod_08', 'Perrier', '330 ml', 350, 'drinks', 'assets/images/menu-perrier.jpg'),
    ('prod_09', 'San Pellegrino Aranciata', '330 ml', 350, 'drinks', 'assets/images/menu-sanpellegrino.jpg'),
    ('prod_10', 'Capri-Sun Apple', '200 ml', 250, 'drinks', 'assets/images/menu-caprisun.jpg'),
    ('prod_11', 'Lay’s Classic', '40 g', 250, 'snacks', 'assets/images/menu-lays.jpg'),
    ('prod_12', 'Lay’s Paprika', '40 g', 250, 'snacks', 'assets/images/menu-lays-paprika.jpg'),
    ('prod_13', 'Pringles Original', '40 g', 300, 'snacks', 'assets/images/menu-pringles.jpg'),
    ('prod_14', 'Doritos Nacho Cheese', '45 g', 300, 'snacks', 'assets/images/menu-doritos.jpg'),
    ('prod_15', 'Chio Tortillas Cheese', '40 g', 250, 'snacks', 'assets/images/menu-chio.jpg'),
    ('prod_16', 'Oreo Original', '66 g', 250, 'snacks', 'assets/images/menu-oreo.jpg'),
    ('prod_17', 'Snickers', '50 g', 250, 'snacks', 'assets/images/menu-snickers.jpg'),
    ('prod_18', 'M&M’s Peanut', '45 g', 300, 'snacks', 'assets/images/menu-mms.jpg'),
    ('prod_19', 'KitKat', '45 g', 250, 'snacks', 'assets/images/menu-kitkat.jpg'),
    ('prod_20', 'Twix', '50 g', 250, 'snacks', 'assets/images/menu-twix.jpg'),
    ('prod_21', 'Red Bull Original', '250 ml', 450, 'drinks', 'assets/images/menu-redbull.jpg'),
    ('prod_22', 'Lipton Ice Tea Peach', '500 ml', 350, 'drinks', 'assets/images/menu-lipton.jpg'),
    ('prod_23', 'Starbucks Frappuccino', '250 ml', 500, 'drinks', 'assets/images/menu-starbucks.jpg'),
    ('prod_24', 'innocent Smooth Orange', '330 ml', 400, 'drinks', 'assets/images/menu-innocent.jpg'),
    ('prod_25', 'Schweppes Indian Tonic', '330 ml', 300, 'drinks', 'assets/images/menu-schweppes.jpg'),
    ('prod_26', 'Haribo Goldbears', '100 g', 300, 'snacks', 'assets/images/menu-haribo.jpg'),
    ('prod_27', 'Kinder Bueno', '43 g', 300, 'snacks', 'assets/images/menu-kinder.jpg'),
    ('prod_28', 'Milka Alpine Milk', '100 g', 400, 'snacks', 'assets/images/menu-milka.jpg'),
    ('prod_29', 'Nutella & Go', '52 g', 350, 'snacks', 'assets/images/menu-nutella.jpg'),
    ('prod_30', 'Nature Valley Oats & Honey', '42 g', 250, 'snacks', 'assets/images/menu-naturevalley.jpg'),
    ('prod_31', 'Monster Energy', '500 ml', 400, 'drinks', 'assets/images/menu-monster.jpg'),
    ('prod_32', 'Fuze Tea Lemon', '500 ml', 300, 'drinks', 'assets/images/menu-fuzetea.jpg'),
    ('prod_33', 'Tropicana Orange', '330 ml', 350, 'drinks', 'assets/images/menu-tropicana.jpg'),
    ('prod_34', 'Heineken 0.0', '330 ml', 400, 'drinks', 'assets/images/menu-heineken.jpg'),
    ('prod_35', 'Nescafé Xpress Latte', '250 ml', 400, 'drinks', 'assets/images/menu-nescafe.jpg'),
    ('prod_36', 'Toblerone', '100 g', 450, 'snacks', 'assets/images/menu-toblerone.jpg'),
    ('prod_37', 'Bounty', '57 g', 250, 'snacks', 'assets/images/menu-bounty.jpg'),
    ('prod_38', 'Mars', '51 g', 250, 'snacks', 'assets/images/menu-mars.jpg'),
    ('prod_39', 'Lindt Lindor Milk', '100 g', 600, 'snacks', 'assets/images/menu-lindor.jpg'),
    ('prod_40', 'Pringles Sour Cream & Onion', '40 g', 300, 'snacks', 'assets/images/menu-pringles-sco.jpg');
GO

CREATE OR ALTER PROCEDURE dbo.usp_PreFlightSyncToDitto
    @FlightNumber NVARCHAR(20) = 'BA123',
    @FlightDate NVARCHAR(20) = '31/10/2026'
AS
BEGIN
    SET NOCOUNT ON;

    SELECT * FROM dbo.Flights WHERE FlightNumber = @FlightNumber AND FlightDate = @FlightDate;
    SELECT * FROM dbo.Stewards WHERE FlightNumber = @FlightNumber AND FlightDate = @FlightDate;
    SELECT * FROM dbo.Passengers WHERE FlightId = @FlightNumber AND FlightDate = @FlightDate;
    SELECT * FROM dbo.Products;

    INSERT INTO dbo.SyncAuditLogs (SyncPhase, DittoDatabaseId, DittoCloudEndpoint, FlightNumber, FlightDate, RecordsSynced, Details)
    VALUES (
        'PRE_FLIGHT_SYNC',
        '965957f9-6fd7-4d2f-8794-d8f1544c5724',
        'i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724',
        @FlightNumber,
        @FlightDate,
        44,
        'Synced flight manifest, crew data, and 40 onboard menu products to Ditto Big Peer before takeoff.'
    );
END
GO

CREATE OR ALTER PROCEDURE dbo.usp_PostFlightSyncFromDitto
    @FlightNumber NVARCHAR(20) = 'BA123',
    @FlightDate NVARCHAR(20) = '31/10/2026',
    @RecordsCount INT = 0
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Flights
    SET Status = 'COMPLETED',
        LastSyncedAt = SYSUTCDATETIME()
    WHERE FlightNumber = @FlightNumber AND FlightDate = @FlightDate;

    INSERT INTO dbo.SyncAuditLogs (SyncPhase, DittoDatabaseId, DittoCloudEndpoint, FlightNumber, FlightDate, RecordsSynced, Details)
    VALUES (
        'POST_FLIGHT_SYNC',
        '965957f9-6fd7-4d2f-8794-d8f1544c5724',
        'i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724',
        @FlightNumber,
        @FlightDate,
        @RecordsCount,
        'Post-flight upload from Steward tablet completed.'
    );
END
GO


