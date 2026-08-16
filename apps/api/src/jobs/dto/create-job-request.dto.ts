import { ArrayNotEmpty, IsArray, IsUrl } from "class-validator";

export class CreateJobRequestDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { each: true })
  urls: string[];
}
