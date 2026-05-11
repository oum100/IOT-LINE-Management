DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'MachineStatus' AND e.enumlabel = 'REPLACED'
  ) THEN
    ALTER TYPE "MachineStatus" ADD VALUE 'REPLACED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'IotDeviceStatus' AND e.enumlabel = 'REPLACED'
  ) THEN
    ALTER TYPE "IotDeviceStatus" ADD VALUE 'REPLACED';
  END IF;
END $$;
