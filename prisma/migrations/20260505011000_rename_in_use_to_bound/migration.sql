DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IotDeviceStatus' AND e.enumlabel = 'IN_USE'
  ) THEN
    ALTER TYPE "IotDeviceStatus" RENAME VALUE 'IN_USE' TO 'BOUND';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MachineStatus' AND e.enumlabel = 'IN_USE'
  ) THEN
    ALTER TYPE "MachineStatus" RENAME VALUE 'IN_USE' TO 'BOUND';
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MachineUnitStatus') THEN
    ALTER TYPE "MachineUnitStatus" RENAME VALUE 'IN_USE' TO 'BOUND';
  END IF;
END $$;
