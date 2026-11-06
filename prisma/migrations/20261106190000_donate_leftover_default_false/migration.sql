-- iAI mode with donation on spends the leftover after personal tasks, up to the safety margin.
-- New accounts do not donate unless they opt in. Rows already stored keep their value.
ALTER TABLE "User" ALTER COLUMN "donateLeftover" SET DEFAULT false;
