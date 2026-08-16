import { IsUUID } from "class-validator";

export class DeleteJobDto {
  @IsUUID("4")
  id: string;
}
